import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, assertEscopo, assertEscopoCandidato, assertEscopoContratacao } from "@/lib/tenant.server";

const SelecionarInput = z.object({
  candidato_id: z.string().uuid(),
  data: z.string().min(10),
  obs: z.string().max(2000).optional().default(""),
});

export const selecionarParaEntrevista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SelecionarInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await assertPerm(userId, "gerenciar_vagas");
    const cand = await assertEscopoCandidato(me, data.candidato_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (cand.etapa === "contratado" || cand.etapa === "nao_contratado") throw new Error("Jornada já encerrada.");
    if (cand.vaga_id) {
      const { data: vaga } = await supabaseAdmin.from("vagas").select("status, encerrada_em").eq("id", cand.vaga_id).maybeSingle();
      if (!vaga || vaga.status === "Fechada" || vaga.encerrada_em) throw new Error("Vaga já encerrada.");
    }

    const { error } = await supabaseAdmin.from("candidatos_televendas")
      .update({ etapa: "entrevista", entrevista_data: data.data, entrevista_obs: data.obs || null, etapa_atualizada_em: new Date().toISOString() })
      .eq("id", data.candidato_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RemoverInput = z.object({ candidato_id: z.string().uuid() });

export const removerEntrevista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RemoverInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await assertPerm(userId, "gerenciar_vagas");
    const cand = await assertEscopoCandidato(me, data.candidato_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (cand.etapa !== "entrevista") throw new Error("Candidato não está na etapa de entrevista.");
    if (cand.vaga_id) {
      const { data: vaga } = await supabaseAdmin.from("vagas").select("status, encerrada_em").eq("id", cand.vaga_id).maybeSingle();
      if (!vaga || vaga.status === "Fechada" || vaga.encerrada_em) throw new Error("Vaga já encerrada.");
    }
    const { error } = await supabaseAdmin.from("candidatos_televendas")
      .update({ etapa: "inscrito", entrevista_data: null, entrevista_obs: null, etapa_atualizada_em: new Date().toISOString() })
      .eq("id", data.candidato_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SetLiderInput = z.object({ contratacao_id: z.string().uuid(), lider_id: z.string().uuid().nullable() });
export const definirLiderContratacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetLiderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await assertPerm(userId, "encerrar_vagas");
    const contr = await assertEscopoContratacao(me, data.contratacao_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Líder precisa ser da mesma empresa da contratação.
    if (data.lider_id) {
      const { data: lider } = await supabaseAdmin
        .from("lideres").select("id, empresa_id").eq("id", data.lider_id).maybeSingle();
      if (!lider) throw new Error("Líder não encontrado.");
      await assertEscopo(me, { empresa_id: lider.empresa_id });
      if (lider.empresa_id !== contr.empresa_id) throw new Error("Líder não pertence à empresa da contratação.");
    }
    const { error } = await supabaseAdmin.from("contratacoes").update({ lider_id: data.lider_id }).eq("id", data.contratacao_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
