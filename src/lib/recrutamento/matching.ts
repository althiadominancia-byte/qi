// QinMatch v1 — scoring puro (sem I/O), multidimensional e EXPLICÁVEL.
// Regras de negócio + pesos configuráveis (a versão semântica/embeddings entra
// como dimensão adicional depois). Nunca decide sozinho — é apoio à decisão.

export type PesoVaga = "essencial" | "importante" | "desejavel";

export type QinMatchInput = {
  vagaCompetencias: { competencia_id: string; nome: string; tipo: string; peso: PesoVaga; nivel_min: number | null }[];
  candidatoCompetencias: { competencia_id: string; nome: string; tipo: string; nivel: number }[];
  evidenciaCompetenciaIds: string[];              // competências com evidência anexada
  comportamental: number | null;                  // 0..100 (match_final DISC/situacional já existente)
  preferencias: { modelo_trabalho?: string | null } | null;
  vaga: { tipo?: string | null; modelo?: string | null };
};

export type QinMatchResult = {
  score_geral: number;
  dimensoes: { competencias: number; comportamental: number; evidencias: number; potencial: number; condicoes: number };
  explicacao: { pontos_fortes: string[]; lacunas: string[]; o_que_validar: string[] };
  criterios: Record<string, number>;
};

// Pesos das dimensões no score geral (configuráveis; gravados em match_scores.criterios).
export const QINMATCH_PESOS = { competencias: 0.40, comportamental: 0.25, evidencias: 0.10, potencial: 0.15, condicoes: 0.10 };
const PESO_VAL: Record<PesoVaga, number> = { essencial: 3, importante: 2, desejavel: 1 };

export function calcularQinMatch(inp: QinMatchInput): QinMatchResult {
  const candMap = new Map(inp.candidatoCompetencias.map((c) => [c.competencia_id, c]));
  const evid = new Set(inp.evidenciaCompetenciaIds);
  const fortes: string[] = [], lacunas: string[] = [], validar: string[] = [];

  // 1) Competências — cobertura ponderada pelo peso da vaga e pelo nível exigido.
  let somaPeso = 0, somaCob = 0;
  for (const vc of inp.vagaCompetencias) {
    const w = PESO_VAL[vc.peso] ?? 2;
    somaPeso += w;
    const cand = candMap.get(vc.competencia_id);
    let cob = 0;
    if (cand) {
      cob = vc.nivel_min ? Math.min(1, cand.nivel / vc.nivel_min) : 1;
      if (cob >= 0.8 && vc.peso === "essencial") fortes.push(vc.nome);
      if (!evid.has(vc.competencia_id)) validar.push(vc.nome);
    } else if (vc.peso !== "desejavel") {
      lacunas.push(vc.nome); // lacuna desenvolvível (essencial/importante ausente)
    }
    somaCob += w * cob;
  }
  const dimCompetencias = somaPeso ? Math.round((somaCob / somaPeso) * 100) : (inp.vagaCompetencias.length ? 0 : 60);

  // 2) Comportamental — reusa o match DISC/situacional já calculado.
  const dimComportamental = inp.comportamental != null ? Math.round(inp.comportamental) : 50;
  if (dimComportamental >= 75) fortes.push("Perfil comportamental aderente");

  // 3) Evidências — confiança: % das competências cobertas que têm evidência.
  const cobertas = inp.vagaCompetencias.filter((vc) => candMap.has(vc.competencia_id));
  const comEvid = cobertas.filter((vc) => evid.has(vc.competencia_id)).length;
  const dimEvidencias = cobertas.length ? Math.round((comEvid / cobertas.length) * 100) : 40;

  // 4) Potencial — competências transversais (aprendizado, resolução de problemas...).
  const transversais = inp.candidatoCompetencias.filter((c) => c.tipo === "transversal").length;
  const dimPotencial = Math.min(100, transversais * 34);

  // 5) Condições — alinhamento de modelo de trabalho (quando informado).
  let dimCondicoes = 70;
  const pm = inp.preferencias?.modelo_trabalho, vm = inp.vaga?.modelo;
  if (pm && vm) dimCondicoes = (pm === "indiferente" || pm.toLowerCase() === String(vm).toLowerCase()) ? 100 : 45;

  const dimensoes = { competencias: dimCompetencias, comportamental: dimComportamental, evidencias: dimEvidencias, potencial: dimPotencial, condicoes: dimCondicoes };
  const w = QINMATCH_PESOS;
  const score_geral = Math.round(
    dimensoes.competencias * w.competencias + dimensoes.comportamental * w.comportamental +
    dimensoes.evidencias * w.evidencias + dimensoes.potencial * w.potencial + dimensoes.condicoes * w.condicoes,
  );

  return {
    score_geral,
    dimensoes,
    explicacao: {
      pontos_fortes: dedup(fortes).slice(0, 6),
      lacunas: dedup(lacunas).slice(0, 6),
      o_que_validar: dedup(validar).slice(0, 6),
    },
    criterios: QINMATCH_PESOS,
  };
}

function dedup(a: string[]) { return Array.from(new Set(a)); }
