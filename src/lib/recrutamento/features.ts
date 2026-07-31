// Entitlements por empresa (o que cada tenant tem liberado conforme o plano
// contratado). É a camada de GESTÃO DO SAAS — distinta das permissões de papel
// (que dizem o que cada USUÁRIO pode fazer dentro do que a empresa tem).
//
// Fluxo: super_admin define PLANOS (modelos) com um conjunto de features; cada
// empresa recebe um plano; exceções pontuais via override na própria empresa.
// features efetivas = features do plano, sobrescritas pelo override da empresa.

export const FEATURE_KEYS = [
  "analise_cv_ia",
  "disc",
  "situacional",
  "diversidade",
  "avaliacao_experiencia",
  "niveis_lideranca",
  "multiplas_unidades",
  "white_label",
  "exportacao",
  "entrevista_ia",
  // FAIL-CLOSED (exposição de dados): o gating server-side do portal usa
  // portalHabilitado() / RPC empresa_tem_portal (default false), NÃO o
  // hasFeature permissivo abaixo.
  "portal_candidato",
  "video_pitch",
  "inscricao_publica",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, { nome: string; desc: string }> = {
  analise_cv_ia: { nome: "Análise de CV com IA", desc: "Leitura do currículo e nota de match" },
  disc: { nome: "Avaliação DISC", desc: "Perfil comportamental no formulário" },
  situacional: { nome: "Questões situacionais", desc: "Cenários no formulário do candidato" },
  diversidade: { nome: "Relatório de diversidade", desc: "Painel agregado (LGPD)" },
  avaliacao_experiencia: {
    nome: "Avaliação de experiência",
    desc: "Acompanhamento 30/60/90 pós-contratação",
  },
  niveis_lideranca: { nome: "Níveis de liderança", desc: "Cadastro de níveis + líderes" },
  multiplas_unidades: { nome: "Múltiplas unidades", desc: "Matriz + filiais" },
  white_label: { nome: "Identidade visual (white-label)", desc: "Logo e cores próprias" },
  exportacao: { nome: "Exportação de dados", desc: "Baixar candidatos e relatórios" },
  entrevista_ia: {
    nome: "Entrevista por vídeo com IA",
    desc: "Sala de vídeo + análise de conteúdo",
  },
  portal_candidato: {
    nome: "Portal do Candidato",
    desc: "Candidato cria conta e acompanha candidaturas, passaporte e entrevistas",
  },
  video_pitch: {
    nome: "Vídeo de apresentação",
    desc: "Candidato grava um pitch; análise do conteúdo falado pela IA",
  },
  inscricao_publica: {
    nome: "Inscrição por link público",
    desc: "Divulgar a vaga por link para candidatos externos se inscreverem",
  },
};

// Modelos padrão — servem para semear a tabela `planos` e como referência.
export type PlanoModelo = {
  nome: string;
  descricao: string;
  features: Record<FeatureKey, boolean>;
};

const allFalse = (): Record<FeatureKey, boolean> =>
  Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])) as Record<FeatureKey, boolean>;
const allTrue = (): Record<FeatureKey, boolean> =>
  Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as Record<FeatureKey, boolean>;

export const PLAN_PRESETS: Record<"basico" | "pro" | "enterprise", PlanoModelo> = {
  basico: {
    nome: "Básico",
    descricao: "Vagas, candidatos e DISC. Recursos avançados desligados.",
    features: { ...allFalse(), disc: true, situacional: true, inscricao_publica: true },
  },
  pro: {
    nome: "Pro",
    descricao: "Recrutamento completo com IA, diversidade e múltiplas unidades.",
    features: {
      ...allFalse(),
      analise_cv_ia: true,
      disc: true,
      situacional: true,
      diversidade: true,
      avaliacao_experiencia: true,
      niveis_lideranca: true,
      multiplas_unidades: true,
      exportacao: true,
      portal_candidato: true,
      video_pitch: true,
      inscricao_publica: true,
    },
  },
  enterprise: {
    nome: "Enterprise",
    descricao: "Tudo liberado, incluindo white-label e entrevista por vídeo com IA.",
    features: allTrue(),
  },
};

/**
 * Resolve as features efetivas de uma empresa.
 * - Sem plano E sem override => permissivo (tudo liberado) para não travar
 *   empresas legadas antes de os planos serem configurados.
 * - Com plano/override => override da empresa vence o padrão do plano.
 */
export function resolveFeatures(
  planoFeatures: Record<string, boolean> | null | undefined,
  override: Record<string, boolean> | null | undefined,
): Record<FeatureKey, boolean> {
  const semPlano = !planoFeatures || Object.keys(planoFeatures).length === 0;
  const semOverride = !override || Object.keys(override).length === 0;
  const out = {} as Record<FeatureKey, boolean>;
  for (const k of FEATURE_KEYS) {
    if (semPlano && semOverride) {
      out[k] = true;
      continue;
    }
    out[k] = override && k in override ? !!override[k] : !!(planoFeatures && planoFeatures[k]);
  }
  return out;
}

/** Lê uma feature do mapa efetivo. Desconhecido/carregando => permissivo (não esconde por engano). */
export function hasFeature(
  features: Record<string, boolean> | null | undefined,
  key: FeatureKey,
): boolean {
  if (!features) return true;
  return features[key] !== false;
}
