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
          return { competencia_id: t.id, nome: t.nome, tipo: t.tipo, peso, nivel_min: null };
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
