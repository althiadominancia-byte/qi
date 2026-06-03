import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EncerrarInput = z.object({
  vaga_id: z.string().uuid(),
  selecionou: z.boolean(),
  candidato_id: z.string().uuid().optional().nullable(),
  data_admissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  lider_id: z.string().uuid().optional().nullable(),
  obs: z.string().max(2000).optional().default(""),
});

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function ensurePermEncerrar(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: me } = await supabaseAdmin.from("usuarios").select("id, role, ativo").eq("id", userId).maybeSingle();
  if (!me?.ativo) throw new Error("Usuário não autorizado.");
  if (me.role === "super_admin") return;
  const { data: perm } = await supabaseAdmin.rpc("user_effective_perms" as any, { _user_id: userId });
  const allow = (perm as any)?.encerrar_vagas ?? false;
  if (!allow) throw new Error("Você não tem permissão para encerrar vagas.");
}

export const encerrarVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EncerrarInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensurePermEncerrar(userId);

    const { data: vaga, error: vErr } = await supabaseAdmin
      .from("vagas").select("id, empresa_id, unidade_id, status").eq("id", data.vaga_id).maybeSingle();
    if (vErr || !vaga) throw new Error("Vaga não encontrada.");

    if (data.selecionou) {
      if (!data.candidato_id || !data.data_admissao) {
        throw new Error("Selecione o candidato e a data de admissão.");
      }
      const { data: cand, error: cErr } = await supabaseAdmin
        .from("candidatos_televendas")
        .select("id, nome, email, celular, vaga_id")
        .eq("id", data.candidato_id).maybeSingle();
      if (cErr || !cand) throw new Error("Candidato não encontrado.");
      if (cand.vaga_id !== data.vaga_id) throw new Error("Candidato não pertence a esta vaga.");

      // 1) Encerra vaga
      const { error: upErr } = await supabaseAdmin.from("vagas")
        .update({ status: "Fechada", encerrada_em: new Date().toISOString(), obs_encerramento: data.obs ?? "" })
        .eq("id", data.vaga_id);
      if (upErr) throw new Error("Falha ao encerrar vaga: " + upErr.message);

      // 2) Cria contratação
      const { data: contr, error: insErr } = await supabaseAdmin.from("contratacoes")
        .insert({
          vaga_id: data.vaga_id,
          candidato_id: cand.id,
          nome: cand.nome,
          email: cand.email,
          telefone: cand.celular ?? "",
          data_admissao: data.data_admissao,
          status: "ativa",
        } as any)
        .select("id, empresa_id, unidade_id, data_admissao").maybeSingle();
      if (insErr || !contr) {
        // rollback
        await supabaseAdmin.from("vagas").update({ status: vaga.status, encerrada_em: null }).eq("id", data.vaga_id);
        throw new Error("Falha ao registrar contratação: " + (insErr?.message ?? ""));
      }

      // 3) Cria 3 avaliações
      const marcos = [30, 60, 90] as const;
      const rows = marcos.map((m) => ({
        contratacao_id: contr.id,
        marco: m,
        data_prevista: addDaysISO(data.data_admissao!, m),
        status: "agendada",
      }));
      const { error: avErr } = await supabaseAdmin.from("avaliacoes_experiencia").insert(rows as any);
      if (avErr) {
        await supabaseAdmin.from("contratacoes").delete().eq("id", contr.id);
        await supabaseAdmin.from("vagas").update({ status: vaga.status, encerrada_em: null }).eq("id", data.vaga_id);
        throw new Error("Falha ao agendar avaliações: " + avErr.message);
      }

      return { ok: true, contratacao_id: contr.id };
    }

    // Caminho "Não" — só encerra
    const { error: upErr } = await supabaseAdmin.from("vagas")
      .update({ status: "Fechada", encerrada_em: new Date().toISOString(), obs_encerramento: data.obs ?? "" })
      .eq("id", data.vaga_id);
    if (upErr) throw new Error("Falha ao encerrar vaga: " + upErr.message);
    return { ok: true };
  });

const ListCandInput = z.object({ vaga_id: z.string().uuid() });
export const listCandidatosDaVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListCandInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("candidatos_televendas")
      .select("id, nome, email, celular, match_final, match_label, perfil_nome")
      .eq("vaga_id", data.vaga_id)
      .order("match_final", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const VagaIdInput = z.object({ vaga_id: z.string().uuid() });
export const getContratacaoByVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VagaIdInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contr } = await supabaseAdmin.from("contratacoes")
      .select("id, nome, email, telefone, data_admissao, status, candidato_id")
      .eq("vaga_id", data.vaga_id).maybeSingle();
    if (!contr) return null;
    const { data: avs } = await supabaseAdmin.from("avaliacoes_experiencia")
      .select("id, marco, data_prevista, status, enviada_em, token")
      .eq("contratacao_id", contr.id)
      .order("marco");
    return { ...contr, avaliacoes: avs ?? [] };
  });

const AvIdInput = z.object({ avaliacao_id: z.string().uuid() });
export const reenviarAvaliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AvIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await ensurePermEncerrar(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("avaliacoes_experiencia")
      .update({ status: "enviada", enviada_em: new Date().toISOString() })
      .eq("id", data.avaliacao_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarAvaliacaoRespondida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AvIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await ensurePermEncerrar(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("avaliacoes_experiencia")
      .update({ status: "respondida" })
      .eq("id", data.avaliacao_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
