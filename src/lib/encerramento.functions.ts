import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertPerm,
  assertEscopo,
  assertEscopoVaga,
  assertEscopoAvaliacao,
} from "@/lib/tenant.server";

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

// Garante a permissão de encerrar vagas e retorna o ator (para checagem de escopo).
const ensurePermEncerrar = (userId: string) => assertPerm(userId, "encerrar_vagas");

export const encerrarVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EncerrarInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await ensurePermEncerrar(userId);

    // Escopo: a vaga precisa pertencer à empresa/unidade do usuário.
    const vaga = await assertEscopoVaga(me, data.vaga_id);

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

      // Líder (opcional) precisa ser da mesma empresa da vaga.
      if (data.lider_id) {
        const { data: lider } = await supabaseAdmin
          .from("lideres").select("id, empresa_id").eq("id", data.lider_id).maybeSingle();
        if (!lider) throw new Error("Líder não encontrado.");
        await assertEscopo(me, { empresa_id: lider.empresa_id });
      }

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
          lider_id: data.lider_id ?? null,
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

      // 4) Atualiza jornada dos candidatos
      const now = new Date().toISOString();
      await supabaseAdmin.from("candidatos_televendas")
        .update({ etapa: "contratado", nao_contratado_motivo: null, etapa_atualizada_em: now })
        .eq("id", cand.id);
      await supabaseAdmin.from("candidatos_televendas")
        .update({ etapa: "nao_contratado", nao_contratado_motivo: "vaga_preenchida", etapa_atualizada_em: now })
        .eq("vaga_id", data.vaga_id)
        .neq("id", cand.id);

      return { ok: true, contratacao_id: contr.id };
    }

    // Caminho "Não" — só encerra
    const { error: upErr } = await supabaseAdmin.from("vagas")
      .update({ status: "Fechada", encerrada_em: new Date().toISOString(), obs_encerramento: data.obs ?? "" })
      .eq("id", data.vaga_id);
    if (upErr) throw new Error("Falha ao encerrar vaga: " + upErr.message);
    await supabaseAdmin.from("candidatos_televendas")
      .update({ etapa: "nao_contratado", nao_contratado_motivo: "encerramento_insucesso", etapa_atualizada_em: new Date().toISOString() })
      .eq("vaga_id", data.vaga_id);
    return { ok: true };
  });

const ListCandInput = z.object({ vaga_id: z.string().uuid() });
export const listCandidatosDaVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListCandInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await assertPerm(userId, "ver_candidatos");
    await assertEscopoVaga(me, data.vaga_id);
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
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await assertPerm(userId, "ver_candidatos");
    await assertEscopoVaga(me, data.vaga_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contr } = await supabaseAdmin.from("contratacoes")
      .select("id, nome, email, telefone, data_admissao, status, candidato_id, lider_id")
      .eq("vaga_id", data.vaga_id).maybeSingle();
    if (!contr) return null;
    const { data: avs } = await supabaseAdmin.from("avaliacoes_experiencia")
      .select("id, marco, data_prevista, status, enviada_em, token")
      .eq("contratacao_id", contr.id)
      .order("marco");
    let lider: any = null;
    if (contr.lider_id) {
      const { data: l } = await supabaseAdmin.from("lideres").select("id, nome, nivel").eq("id", contr.lider_id).maybeSingle();
      lider = l ?? null;
    }
    return { ...contr, avaliacoes: avs ?? [], lider };
  });

const AvIdInput = z.object({ avaliacao_id: z.string().uuid() });
export const reenviarAvaliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AvIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await ensurePermEncerrar(userId);
    await assertEscopoAvaliacao(me, data.avaliacao_id);
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
    const me = await ensurePermEncerrar(userId);
    await assertEscopoAvaliacao(me, data.avaliacao_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("avaliacoes_experiencia")
      .update({ status: "respondida" })
      .eq("id", data.avaliacao_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
