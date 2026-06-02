// Fonte da verdade — NÃO ALTERAR sem revisar com RH.
// Copiado verbatim dos componentes originais FormularioTelevendasEstrela / PainelRecrutadorEstrela.

export const ROXO = "#50328A";
export const ROXO_DARK = "#3A2566";
export const ROXO_TINT = "#F4F1FB";
export const ROXO_TINT2 = "#E9E3F7";
export const LARANJA = "#EB5717";
export const LARANJA_TINT = "#FDEDE5";
export const CINZA = "#5B5566";
export const BORDA = "#E6E1F0";
export const VERDE = "#16A34A";

export type Dim = "D" | "I" | "S" | "C";

export const DISC_BLOCKS: { opcoes: { dim: Dim; txt: string }[] }[] = [
  { opcoes: [
    { dim: "D", txt: "Decidido(a), resolvo as coisas rápido" },
    { dim: "I", txt: "Comunicativo(a), falo com facilidade" },
    { dim: "S", txt: "Paciente, mantenho a calma" },
    { dim: "C", txt: "Caprichoso(a) com os detalhes" },
  ]},
  { opcoes: [
    { dim: "I", txt: "Gosto de animar e influenciar as pessoas" },
    { dim: "C", txt: "Gosto de fazer tudo certo e organizado" },
    { dim: "D", txt: "Gosto de assumir o comando" },
    { dim: "S", txt: "Gosto de apoiar a equipe" },
  ]},
  { opcoes: [
    { dim: "S", txt: "Foco na harmonia do grupo" },
    { dim: "D", txt: "Foco no resultado" },
    { dim: "C", txt: "Foco na qualidade" },
    { dim: "I", txt: "Foco nas pessoas" },
  ]},
  { opcoes: [
    { dim: "C", txt: "Sou cuidadoso(a) e ponderado(a)" },
    { dim: "S", txt: "Sou tranquilo(a) e estável" },
    { dim: "I", txt: "Sou entusiasmado(a) e animado(a)" },
    { dim: "D", txt: "Sou direto(a) e objetivo(a)" },
  ]},
  { opcoes: [
    { dim: "D", txt: "Encaro desafios de frente" },
    { dim: "S", txt: "Escuto com atenção antes de agir" },
    { dim: "I", txt: "Convenço as pessoas pelo meu jeito" },
    { dim: "C", txt: "Analiso tudo antes de decidir" },
  ]},
  { opcoes: [
    { dim: "I", txt: "Gosto de socializar e conhecer gente" },
    { dim: "S", txt: "Gosto de colaborar com todos" },
    { dim: "C", txt: "Gosto de planejar antes de agir" },
    { dim: "D", txt: "Gosto de liderar e decidir" },
  ]},
  { opcoes: [
    { dim: "C", txt: "Sou preciso(a) e metódico(a)" },
    { dim: "D", txt: "Sou competitivo(a) e focado(a) em meta" },
    { dim: "S", txt: "Sou constante e confiável na rotina" },
    { dim: "I", txt: "Sou expansivo(a) e extrovertido(a)" },
  ]},
];

export const SITUACIONAIS = [
  {
    id: "q1",
    titulo: "Durante o atendimento, o cliente solta uma cantada: “Você tem uma voz tão bonita, tá solteira?”. Você:",
    options: [
      { key: "a", pts: 100, txt: "Levo na esportiva com bom humor, agradeço de forma educada e trago a conversa de volta para o pedido." },
      { key: "b", pts: 70, txt: "Corto na hora, digo de forma firme que prefiro manter o foco no atendimento e sigo." },
      { key: "c", pts: 40, txt: "Fico sem graça e não sei muito bem o que responder." },
      { key: "d", pts: 20, txt: "Entro na brincadeira para não perder a simpatia e a venda." },
    ],
  },
  {
    id: "q2",
    titulo: "O cliente está irritado, falando alto e reclamando de algo que não foi você quem causou. Você:",
    options: [
      { key: "a", pts: 100, txt: "Escuto até o fim sem interromper, valido o incômodo dele e foco na solução." },
      { key: "b", pts: 45, txt: "Explico logo de cara que não fui eu que errei." },
      { key: "c", pts: 55, txt: "Transfiro a ligação o mais rápido possível para outra pessoa resolver." },
      { key: "d", pts: 15, txt: "Elevo o tom também para me impor na conversa." },
    ],
  },
  {
    id: "q3",
    titulo: "Você está há duas horas ligando e levando muitos “nãos” seguidos. Você:",
    options: [
      { key: "a", pts: 100, txt: "Respiro, ajusto minha abordagem e sigo ligando com a mesma energia." },
      { key: "b", pts: 75, txt: "Faço uma pausa rápida para recuperar o ânimo e volto." },
      { key: "c", pts: 35, txt: "Desanimo e meu ritmo cai bastante." },
      { key: "d", pts: 40, txt: "Começo a ligar no automático, só para cumprir a meta de ligações." },
    ],
  },
  {
    id: "q4",
    titulo: "Um cliente em dúvida diz “vou pensar e depois te retorno”. Você:",
    options: [
      { key: "a", pts: 100, txt: "Faço perguntas para entender a real objeção e ofereço algo que ajude a decidir agora." },
      { key: "b", pts: 70, txt: "Agradeço e combino um horário certo para retornar." },
      { key: "c", pts: 35, txt: "Agradeço e encerro a ligação." },
      { key: "d", pts: 50, txt: "Insisto bastante para tentar fechar na hora, de qualquer jeito." },
    ],
  },
] as const;

export const PERFIS = {
  comunicador: {
    nome: "O Comunicador", tag: "Perfil I", cor: LARANJA, base: 95, match: "Altíssimo",
    resumo: "Extrovertido, persuasivo e cheio de energia. Cria conexão rápida no telefone e adora interagir — é o perfil mais aderente a televendas.",
    forcas: ["Comunicação natural", "Entusiasmo contagiante", "Poder de persuasão", "Cria rapport rápido"],
    atencao: ["Pode falar mais do que ouvir", "Atenção ao registro de dados e follow-up"],
  },
  fechador: {
    nome: "O Fechador", tag: "Perfil D/I", cor: ROXO, base: 88, match: "Alto",
    resumo: "Direto, competitivo e com boa lábia. Adora bater meta e conduz o cliente até o fechamento sem medo.",
    forcas: ["Foco em meta", "Iniciativa", "Lida bem com pressão", "Persuasão assertiva"],
    atencao: ["Pode ser ríspido com cliente sensível", "Cuidar para não atropelar a escuta"],
  },
  diplomatico: {
    nome: "O Diplomático", tag: "Perfil I/S", cor: "#2E8B7A", base: 85, match: "Alto",
    resumo: "Paciente, atencioso e ótimo ouvinte. Constrói confiança e segura bem o cliente difícil ou irritado.",
    forcas: ["Escuta ativa", "Paciência e postura", "Constância", "Fideliza o cliente"],
    atencao: ["Pode demorar a “pedir a venda”", "Tende a evitar conflito necessário"],
  },
  executor: {
    nome: "O Executor", tag: "Perfil D", cor: "#B25A1F", base: 65, match: "Médio",
    resumo: "Decidido, prático e focado em tarefa. Entrega volume e cumpre processo, mas é menos voltado ao relacionamento.",
    forcas: ["Produtividade", "Disciplina", "Decisão rápida"],
    atencao: ["Menos calor humano no atendimento", "Pode soar seco no telefone"],
  },
  analitico: {
    nome: "O Analítico", tag: "Perfil C", cor: "#3B6FB0", base: 55, match: "Baixo",
    resumo: "Detalhista, organizado e preciso. Excelente com cadastro, CRM e regras, porém menos espontâneo na conversa de venda.",
    forcas: ["Precisão e organização", "Segue script à risca", "Ótimo com dados/CRM"],
    atencao: ["Ritmo mais lento na ponta", "Melhor em retaguarda/cadastro do que no telefone"],
  },
} as const;

export type PerfilKey = keyof typeof PERFIS;

export const DIM_INFO: Record<Dim, { nome: string; cor: string }> = {
  D: { nome: "Dominância", cor: "#C0392B" },
  I: { nome: "Influência", cor: LARANJA },
  S: { nome: "Estabilidade", cor: "#2E8B7A" },
  C: { nome: "Conformidade", cor: "#3B6FB0" },
};

export const COR_RACA = ["Branca", "Preta", "Parda", "Amarela", "Indígena", "Prefiro não responder"];
export const GENERO = ["Mulher cisgênero", "Homem cisgênero", "Mulher transgênero", "Homem transgênero", "Não-binário", "Outro", "Prefiro não responder"];
export const ORIENTACAO = ["Heterossexual", "Homossexual", "Bissexual", "Pansexual", "Outra", "Prefiro não responder"];
export const PCD = ["Sim", "Não", "Prefiro não responder"];
export const POLITICO = ["Esquerda", "Centro-esquerda", "Centro", "Centro-direita", "Direita", "Apartidário(a)", "Prefiro não responder"];

export function computeResults(a: Record<string, any>) {
  const disc: Record<Dim, number> = { D: 0, I: 0, S: 0, C: 0 };
  DISC_BLOCKS.forEach((b, bi) => {
    const mais = a["disc_" + bi + "_mais"];
    const menos = a["disc_" + bi + "_menos"];
    if (mais !== undefined) disc[b.opcoes[mais].dim] += 1;
    if (menos !== undefined) disc[b.opcoes[menos].dim] -= 1;
  });
  const N = DISC_BLOCKS.length;
  const pct = (s: number) => Math.max(5, Math.min(100, Math.round(((s + N) / (2 * N)) * 100)));
  const discPct = { D: pct(disc.D), I: pct(disc.I), S: pct(disc.S), C: pct(disc.C) };

  const ordered = (Object.entries(disc) as [Dim, number][]).sort((x, y) => y[1] - x[1]);
  const primary = ordered[0][0];
  const secondary = ordered[1][0];

  let key: PerfilKey;
  if (primary === "C") key = "analitico";
  else if (primary === "I") key = secondary === "D" ? "fechador" : secondary === "S" ? "diplomatico" : "comunicador";
  else if (primary === "D") key = secondary === "I" ? "fechador" : "executor";
  else key = "diplomatico";

  const sitVals = SITUACIONAIS.map((q) => {
    const opt = q.options.find((o) => o.key === a["sit_" + q.id]);
    return opt ? opt.pts : 0;
  });
  const sitAvg = Math.round(sitVals.reduce((s, v) => s + v, 0) / SITUACIONAIS.length);

  const base = PERFIS[key].base;
  const finalMatch = Math.round(base * 0.6 + sitAvg * 0.4);
  const label = finalMatch >= 85 ? "Altíssimo" : finalMatch >= 70 ? "Alto" : finalMatch >= 55 ? "Médio" : "Baixo";

  return { disc, discPct, key, perfil: PERFIS[key], primary, secondary, sitAvg, finalMatch, label };
}

export const labelMatch = (m: number) => (m >= 85 ? "Altíssimo" : m >= 70 ? "Alto" : m >= 55 ? "Médio" : "Baixo");
export const corMatch = (m: number) => (m >= 85 ? VERDE : m >= 70 ? LARANJA : m >= 55 ? "#CA8A04" : "#DC2626");
export const corNivel = (n?: string) => (n === "alta" ? VERDE : n === "media" ? LARANJA : "#9b93b0");
export const txtNivel = (n?: string) => (n === "alta" ? "Alta" : n === "media" ? "Média" : "Baixa");
