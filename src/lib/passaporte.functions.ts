import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, assertEscopoCandidato } from "@/lib/tenant.server";
import { callClaude } from "@/lib/recrutamento.functions";

// Passaporte de Talentos — leitura/escrita das competências, evidências,
// experiências e preferências do candidato + extração estruturada do cv_analise.
// Como toda server fn, valida permissão + escopo do candidato antes de gravar.

const CandId = z.object({ candidatoId: z.string().uuid() });

/** Passaporte completo do candidato (para a UI do recrutador). */
export const getPassaporte = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "ver_candidatos");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const [comps, evids, exps, prefs] = await Promise.all([
      admin.from("candidato_competencias").select("id, nivel, origem, confianca, competencia:competencias(id, nome, tipo)").eq("candidato_id", data.candidatoId),
      admin.from("candidato_evidencias").select("*").eq("candidato_id", data.candidatoId).order("created_at", { ascending: false }),
      admin.from("candidato_experiencias").select("*").eq("candidato_id", data.candidatoId).order("inicio", { ascending: false, nullsFirst: false }),
      admin.from("candidato_preferencias").select("*").eq("candidato_id", data.candidatoId).maybeSingle(),
    ]);
    return {
      competencias: comps.data ?? [],
      evidencias: evids.data ?? [],
      experiencias: exps.data ?? [],
      preferencias: prefs.data ?? null,
    };
  });

/** Taxonomia disponível (global + da própria empresa). */
export const listCompetencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any; // cliente no escopo do usuário (RLS)
    const { data } = await supabase.from("competencias").select("id, nome, tipo, empresa_id").eq("ativo", true).order("tipo").order("nome");
    return data ?? [];
  });

const UpsertComp = z.object({
  candidatoId: z.string().uuid(),
  competencia_id: z.string().uuid(),
  nivel: z.number().int().min(1).max(5).default(3),
  origem: z.enum(["declarada", "avaliada", "ia"]).default("declarada"),
});
export const salvarCompetenciaCandidato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertComp.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "gerenciar_vagas");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("candidato_competencias").upsert({
      candidato_id: data.candidatoId, competencia_id: data.competencia_id, nivel: data.nivel, origem: data.origem,
    }, { onConflict: "candidato_id,competencia_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DelById = z.object({ candidatoId: z.string().uuid(), id: z.string().uuid() });
export const removerCompetenciaCandidato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DelById.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "gerenciar_vagas");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("candidato_competencias").delete().eq("id", data.id).eq("candidato_id", data.candidatoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ExpInput = z.object({
  candidatoId: z.string().uuid(),
  id: z.string().uuid().optional(),
  tipo: z.enum(["formal", "informal", "voluntariado", "projeto", "curso"]).default("formal"),
  titulo: z.string().min(1).max(200),
  organizacao: z.string().max(200).optional().nullable(),
  inicio: z.string().optional().nullable(),
  fim: z.string().optional().nullable(),
  atual: z.boolean().default(false),
  descricao: z.string().max(2000).optional().nullable(),
});
export const salvarExperiencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExpInput.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "gerenciar_vagas");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      candidato_id: data.candidatoId, tipo: data.tipo, titulo: data.titulo,
      organizacao: data.organizacao ?? null, inicio: data.inicio || null, fim: data.fim || null,
      atual: data.atual, descricao: data.descricao ?? null,
    };
    const q = (supabaseAdmin as any).from("candidato_experiencias");
    const { error } = data.id ? await q.update(row).eq("id", data.id).eq("candidato_id", data.candidatoId) : await q.insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerExperiencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DelById.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "gerenciar_vagas");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("candidato_experiencias").delete().eq("id", data.id).eq("candidato_id", data.candidatoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const PrefInput = z.object({
  candidatoId: z.string().uuid(),
  disponibilidade: z.string().max(200).optional().nullable(),
  pretensao_min: z.number().optional().nullable(),
  pretensao_max: z.number().optional().nullable(),
  modelo_trabalho: z.enum(["presencial", "hibrido", "remoto", "indiferente"]).optional().nullable(),
  interesses: z.array(z.string()).default([]),
});
export const salvarPreferencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PrefInput.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "gerenciar_vagas");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("candidato_preferencias").upsert({
      candidato_id: data.candidatoId, disponibilidade: data.disponibilidade ?? null,
      pretensao_min: data.pretensao_min ?? null, pretensao_max: data.pretensao_max ?? null,
      modelo_trabalho: data.modelo_trabalho ?? null, interesses: data.interesses, updated_at: new Date().toISOString(),
    }, { onConflict: "candidato_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Extrai o passaporte estruturado a partir do que já existe (cv_analise da IA,
 * DISC, texto de experiência) e da taxonomia disponível — mapeando para
 * competências (origem = ia) e experiências. Reusa a análise já feita.
 */
export const extrairPassaporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "gerenciar_vagas");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: c } = await admin.from("candidatos_televendas")
      .select("cv_analise, disc_pontuacao, experiencia_texto, setor_atual, empresa_id")
      .eq("id", data.candidatoId).maybeSingle();
    if (!c) throw new Error("Candidato não encontrado.");

    const orFiltro = c.empresa_id ? `empresa_id.is.null,empresa_id.eq.${c.empresa_id}` : "empresa_id.is.null";
    const { data: tax } = await admin.from("competencias")
      .select("id, nome, tipo").eq("ativo", true).or(orFiltro);
    const taxonomia: { id: string; nome: string; tipo: string }[] = tax ?? [];
    if (!taxonomia.length) throw new Error("Nenhuma competência na taxonomia.");

    const lista = taxonomia.map((t) => `${t.nome} (${t.tipo})`).join("; ");
    const prompt = `Você é analista de RH. A partir do material do candidato, identifique quais competências da LISTA ele demonstra, com nível 1–5 e confiança 0–1, e liste experiências estruturadas. Use SOMENTE nomes exatos da lista. Responda SOMENTE JSON válido, sem markdown, no formato:
{"competencias":[{"nome":"<da lista>","nivel":3,"confianca":0.7}],"experiencias":[{"tipo":"formal|informal|voluntariado|projeto|curso","titulo":"","organizacao":"","descricao":""}]}
LISTA DE COMPETÊNCIAS: ${lista}`;
    const material = `ANÁLISE IA: ${JSON.stringify(c.cv_analise ?? {})}\nDISC: ${JSON.stringify(c.disc_pontuacao ?? {})}\nEXPERIÊNCIA (texto): ${c.experiencia_texto ?? ""}\nSETOR ATUAL: ${c.setor_atual ?? ""}`;
    const out: any = await callClaude([{ type: "text", text: prompt + "\n\nMATERIAL:\n" + material }]);

    const byName = new Map(taxonomia.map((t) => [t.nome, t.id]));
    const compRows = (out?.competencias ?? [])
      .filter((x: any) => x?.nome && byName.has(x.nome))
      .map((x: any) => ({
        candidato_id: data.candidatoId, competencia_id: byName.get(x.nome),
        nivel: Math.min(5, Math.max(1, Math.round(x.nivel ?? 3))), origem: "ia",
        confianca: typeof x.confianca === "number" ? Math.min(1, Math.max(0, x.confianca)) : null,
      }));
    if (compRows.length) {
      const { error } = await admin.from("candidato_competencias").upsert(compRows, { onConflict: "candidato_id,competencia_id" });
      if (error) throw new Error("Falha ao gravar competências: " + error.message);
    }
    const expRows = (out?.experiencias ?? [])
      .filter((x: any) => x?.titulo)
      .map((x: any) => ({
        candidato_id: data.candidatoId, tipo: x.tipo ?? "formal", titulo: String(x.titulo).slice(0, 200),
        organizacao: x.organizacao ?? null, descricao: x.descricao ?? null,
      }));
    if (expRows.length) {
      const { error } = await admin.from("candidato_experiencias").insert(expRows);
      if (error) throw new Error("Falha ao gravar experiências: " + error.message);
    }
    return { ok: true, competencias: compRows.length, experiencias: expRows.length };
  });
