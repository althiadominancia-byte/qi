import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensurePerm(userId: string, perm: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: me } = await supabaseAdmin.from("usuarios").select("id, role, ativo").eq("id", userId).maybeSingle();
  if (!me?.ativo) throw new Error("Usuário não autorizado.");
  if (me.role === "super_admin") return;
  const { data: perms } = await supabaseAdmin.rpc("user_effective_perms" as any, { _user_id: userId });
  if (!(perms as any)?.[perm]) throw new Error("Permissão negada: " + perm);
}

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
    await ensurePerm(userId, "gerenciar_vagas");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cand } = await supabaseAdmin
      .from("candidatos_televendas")
      .select("id, vaga_id, etapa")
      .eq("id", data.candidato_id).maybeSingle();
    if (!cand) throw new Error("Candidato não encontrado.");
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
    await ensurePerm(userId, "gerenciar_vagas");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cand } = await supabaseAdmin.from("candidatos_televendas").select("id, vaga_id, etapa").eq("id", data.candidato_id).maybeSingle();
    if (!cand) throw new Error("Candidato não encontrado.");
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
    await ensurePerm(userId, "encerrar_vagas");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contratacoes").update({ lider_id: data.lider_id }).eq("id", data.contratacao_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
