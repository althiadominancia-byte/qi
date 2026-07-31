import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, assertEscopoCandidato, assertEscopoVaga } from "@/lib/tenant.server";
import { calcularQinMatch, type PesoVaga } from "@/lib/recrutamento/matching";

const Input = z.object({ candidatoId: z.string().uuid(), vagaId: z.string().uuid() });

/**
 * Calcula (e grava) o QinMatch entre candidato e vaga. Acesso: ver_candidatos +
 * escopo do candidato E da vaga. Se a vaga não tiver competências mapeadas na
 * taxonomia, faz um fallback mapeando as `habilidades` (nome) geradas pela IA.
 */
export const calcularMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "ver_candidatos");
    await assertEscopoCandidato(me, data.candidatoId);
    await assertEscopoVaga(me, data.vagaId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [cc, ev, pref, cRow, vRow, vc] = await Promise.all([
      admin.from("candidato_competencias").select("competencia_id, nivel, competencia:competencias(nome, tipo)").eq("candidato_id", data.candidatoId),
      admin.from("candidato_evidencias").select("competencia_id").eq("candidato_id", data.candidatoId).not("competencia_id", "is", null),
      admin.from("candidato_preferencias").select("modelo_trabalho").eq("candidato_id", data.candidatoId).maybeSingle(),
      admin.from("candidatos_televendas").select("match_final").eq("id", data.candidatoId).maybeSingle(),
      admin.from("vagas").select("tipo, modelo, habilidades").eq("id", data.vagaId).maybeSingle(),
      admin.from("vaga_competencias").select("competencia_id, peso, nivel_min, competencia:competencias(nome, tipo)").eq("vaga_id", data.vagaId),
    ]);

    const candidatoCompetencias = (cc.data ?? []).map((r: any) => ({
      competencia_id: r.competencia_id, nome: r.competencia?.nome ?? "", tipo: r.competencia?.tipo ?? "tecnica", nivel: r.nivel ?? 3,
    }));
    const evidenciaCompetenciaIds = (ev.data ?? []).map((r: any) => r.competencia_id).filter(Boolean);

    let vagaCompetencias = (vc.data ?? []).map((r: any) => ({
      competencia_id: r.competencia_id, nome: r.competencia?.nome ?? "", tipo: r.competencia?.tipo ?? "tecnica",
      peso: (r.peso ?? "importante") as PesoVaga, nivel_min: r.nivel_min ?? null,
    }));
    // Fallback: mapeia as habilidades (nome) da vaga na taxonomia.
    const habilidades: any[] = Array.isArray(vRow.data?.habilidades) ? vRow.data.habilidades : [];
    if (!vagaCompetencias.length && habilidades.length) {
      const nomes = habilidades.map((h) => h?.nome).filter(Boolean);
      const { data: tax } = await admin.from("competencias").select("id, nome, tipo").in("nome", nomes);
      const byName = new Map((tax ?? []).map((t: any) => [t.nome, t]));
      vagaCompetencias = habilidades
        .filter((h) => h?.nome && byName.has(h.nome))
        .map((h) => {
          const t: any = byName.get(h.nome);
          const peso: PesoVaga = ["essencial", "importante", "desejavel"].includes(h.nivel) ? h.nivel : "importante";
          const nivel_min = typeof h.nivel_min === "number" ? Math.min(5, Math.max(1, Math.round(h.nivel_min))) : null;
          return { competencia_id: t.id, nome: t.nome, tipo: t.tipo, peso, nivel_min };
        });
    }

    const result = calcularQinMatch({
      vagaCompetencias, candidatoCompetencias, evidenciaCompetenciaIds,
      comportamental: cRow.data?.match_final ?? null,
      preferencias: pref.data ?? null,
      vaga: { tipo: vRow.data?.tipo, modelo: vRow.data?.modelo },
    });

    const { error } = await admin.from("match_scores").upsert({
      candidato_id: data.candidatoId, vaga_id: data.vagaId,
      score_geral: result.score_geral, dimensoes: result.dimensoes,
      explicacao: result.explicacao, criterios: result.criterios,
      versao_algoritmo: "qinmatch-v1", updated_at: new Date().toISOString(),
    }, { onConflict: "candidato_id,vaga_id" });
    if (error) throw new Error("Falha ao gravar o match: " + error.message);
    return result;
  });

const SyncInput = z.object({
  vagaId: z.string().uuid(),
  habilidades: z.array(z.object({
    nome: z.string().min(1),
    nivel: z.string().optional(),        // peso (essencial/importante/desejavel)
    nivel_min: z.number().nullable().optional(),
    tipo: z.string().optional(),
  })).default([]),
});

/**
 * Sincroniza as competências de uma vaga (a partir das `habilidades` do formulário)
 * na tabela `vaga_competencias` — o caminho rico que o QinMatch consome. Mapeia cada
 * habilidade para a taxonomia por NOME (case-insensitive); se não existir, CRIA a
 * competência na empresa da vaga. Grava peso + nivel_min e remove as que saíram.
 * Acesso: gerenciar_vagas + escopo da vaga.
 */
export const sincronizarCompetenciasVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SyncInput.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "gerenciar_vagas");
    await assertEscopoVaga(me, data.vagaId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: vaga } = await admin.from("vagas").select("empresa_id").eq("id", data.vagaId).maybeSingle();
    const empresaId = vaga?.empresa_id ?? null;

    // Taxonomia visível para a vaga: globais + da empresa.
    const orFiltro = empresaId ? `empresa_id.is.null,empresa_id.eq.${empresaId}` : "empresa_id.is.null";
    const { data: tax } = await admin.from("competencias").select("id, nome, tipo").eq("ativo", true).or(orFiltro);
    const byName = new Map<string, { id: string; tipo: string }>((tax ?? []).map((t: any) => [String(t.nome).trim().toLowerCase(), { id: t.id, tipo: t.tipo }]));

    const tiposValidos = ["tecnica", "comportamental", "transversal"];
    const pesosValidos = ["essencial", "importante", "desejavel"];
    const rows: { vaga_id: string; competencia_id: string; peso: string; nivel_min: number | null }[] = [];
    const vistos = new Set<string>();

    for (const h of data.habilidades) {
      const nome = h.nome.trim();
      if (!nome) continue;
      const key = nome.toLowerCase();
      let comp = byName.get(key);
      if (!comp) {
        // Cria a competência na taxonomia da empresa (nome novo proposto pela IA/recrutador).
        const tipo = tiposValidos.includes(h.tipo ?? "") ? h.tipo : "tecnica";
        const { data: nova, error } = await admin.from("competencias")
          .insert({ empresa_id: empresaId, nome, tipo, ativo: true })
          .select("id, tipo").single();
        if (error) throw new Error("Falha ao criar competência '" + nome + "': " + error.message);
        comp = { id: nova.id, tipo: nova.tipo };
        byName.set(key, comp);
      }
      if (vistos.has(comp.id)) continue; // dedupe por competência
      vistos.add(comp.id);
      const peso = pesosValidos.includes(h.nivel ?? "") ? (h.nivel as string) : "importante";
      const nivel_min = typeof h.nivel_min === "number" ? Math.min(5, Math.max(1, Math.round(h.nivel_min))) : null;
      rows.push({ vaga_id: data.vagaId, competencia_id: comp.id, peso, nivel_min });
    }

    if (rows.length) {
      const { error } = await admin.from("vaga_competencias").upsert(rows, { onConflict: "vaga_id,competencia_id" });
      if (error) throw new Error("Falha ao gravar competências da vaga: " + error.message);
    }
    // Remove as competências que não estão mais na vaga.
    const manter = Array.from(vistos);
    let del = admin.from("vaga_competencias").delete().eq("vaga_id", data.vagaId);
    if (manter.length) del = del.not("competencia_id", "in", `(${manter.join(",")})`);
    const { error: delErr } = await del;
    if (delErr) throw new Error("Falha ao limpar competências antigas: " + delErr.message);

    return { ok: true, total: rows.length };
  });

/** Lê o QinMatch já calculado (candidato × vaga). */
export const getMatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "ver_candidatos");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await (supabaseAdmin as any).from("match_scores")
      .select("score_geral, dimensoes, explicacao, criterios, versao_algoritmo, updated_at")
      .eq("candidato_id", data.candidatoId).eq("vaga_id", data.vagaId).maybeSingle();
    return m ?? null;
  });
