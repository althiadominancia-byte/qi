// Fonte da verdade — NÃO ALTERAR DISC/SITUACIONAIS sem revisar com RH.

export const ROXO = "#50328A";
export const ROXO_DARK = "#3A2566";
export const ROXO_TINT = "#F4F1FB";
export const ROXO_TINT2 = "#E9E3F7";
export const LARANJA = "#EB5717";
export const LARANJA_TINT = "#FDEDE5";
export const CINZA = "#5B5566";
export const BORDA = "#E6E1F0";
export const VERDE = "#16A34A";
export const AMARELO = "#CA8A04";
export const VERMELHO = "#DC2626";

export type Dim = "D" | "I" | "S" | "C";
export type PerfilKey = "comunicador" | "fechador" | "diplomatico" | "executor" | "analitico";
export type NivelHab = "essencial" | "importante" | "desejavel";

/* ===== DISC FORÇADO (ipsativo) — verbatim ===== */
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
  { id: "q1", titulo: "Durante o atendimento, o cliente solta uma cantada: “Você tem uma voz tão bonita, tá solteira?”. Você:",
    options: [
      { key: "a", pts: 100, txt: "Levo na esportiva com bom humor, agradeço de forma educada e trago a conversa de volta para o pedido." },
      { key: "b", pts: 70, txt: "Corto na hora, digo de forma firme que prefiro manter o foco no atendimento e sigo." },
      { key: "c", pts: 40, txt: "Fico sem graça e não sei muito bem o que responder." },
      { key: "d", pts: 20, txt: "Entro na brincadeira para não perder a simpatia e a venda." },
    ]},
  { id: "q2", titulo: "O cliente está irritado, falando alto e reclamando de algo que não foi você quem causou. Você:",
    options: [
      { key: "a", pts: 100, txt: "Escuto até o fim sem interromper, valido o incômodo dele e foco na solução." },
      { key: "b", pts: 45, txt: "Explico logo de cara que não fui eu que errei." },
      { key: "c", pts: 55, txt: "Transfiro a ligação o mais rápido possível para outra pessoa resolver." },
      { key: "d", pts: 15, txt: "Elevo o tom também para me impor na conversa." },
    ]},
  { id: "q3", titulo: "Você está há duas horas ligando e levando muitos “nãos” seguidos. Você:",
    options: [
      { key: "a", pts: 100, txt: "Respiro, ajusto minha abordagem e sigo ligando com a mesma energia." },
      { key: "b", pts: 75, txt: "Faço uma pausa rápida para recuperar o ânimo e volto." },
      { key: "c", pts: 35, txt: "Desanimo e meu ritmo cai bastante." },
      { key: "d", pts: 40, txt: "Começo a ligar no automático, só para cumprir a meta de ligações." },
    ]},
  { id: "q4", titulo: "Um cliente em dúvida diz “vou pensar e depois te retorno”. Você:",
    options: [
      { key: "a", pts: 100, txt: "Faço perguntas para entender a real objeção e ofereço algo que ajude a decidir agora." },
      { key: "b", pts: 70, txt: "Agradeço e combino um horário certo para retornar." },
      { key: "c", pts: 35, txt: "Agradeço e encerro a ligação." },
      { key: "d", pts: 50, txt: "Insisto bastante para tentar fechar na hora, de qualquer jeito." },
    ]},
];

/* ===== PERFIS GLOBAIS (neutros, qualquer cargo) ===== */
export const PERFIS = {
  comunicador: {
    nome: "O Comunicador", tag: "Perfil I", dim: "I", cor: LARANJA, base: 95,
    resumo: "Extrovertido, persuasivo e sociável. Engaja pessoas com facilidade e tem energia alta para interação.",
    plain: "Pessoa de papo fácil e simpática. Gosta de gente, conversa com qualquer um e contagia com o bom humor. Brilha quando o trabalho é falar e convencer.",
    forcas: ["Comunicação natural", "Entusiasmo contagiante", "Poder de persuasão", "Cria rapport rápido"],
    atencao: ["Pode falar mais do que ouvir", "Atenção ao registro de dados e follow-up"],
  },
  fechador: {
    nome: "O Articulador", tag: "Perfil D/I", dim: "D/I", cor: ROXO, base: 88,
    resumo: "Combina foco em resultado com poder de convencimento. Lidera, negocia e conduz decisões.",
    plain: "Sabe convencer e ao mesmo tempo gosta de resultado. Encara a conversa de frente, negocia e fecha. Bom pra bater meta falando com gente.",
    forcas: ["Foco em meta", "Iniciativa", "Lida bem com pressão", "Persuasão assertiva"],
    atencao: ["Pode ser ríspido com cliente sensível", "Cuidar para não atropelar a escuta"],
  },
  diplomatico: {
    nome: "O Diplomático", tag: "Perfil I/S", dim: "I/S", cor: "#2E8B7A", base: 85,
    resumo: "Paciente, colaborativo e ótimo ouvinte. Constrói confiança e mantém a estabilidade do time.",
    plain: "Calmo, paciente e bom ouvinte. Deixa as pessoas à vontade e segura bem cliente nervoso. Constrói uma relação de confiança ao longo do tempo.",
    forcas: ["Escuta ativa", "Paciência e postura", "Constância", "Fideliza o cliente"],
    atencao: ["Pode demorar a “pedir a venda”", "Tende a evitar conflito necessário"],
  },
  executor: {
    nome: "O Realizador", tag: "Perfil D", dim: "D", cor: "#B25A1F", base: 65,
    resumo: "Direto, decidido e focado em entregar. Age rápido, encara desafios e cumpre o que se propõe.",
    plain: "Direto e movido a desafio. Decide rápido, não tem medo de pressão e gosta de entregar e ver resultado. Vai direto ao ponto.",
    forcas: ["Produtividade", "Disciplina", "Decisão rápida"],
    atencao: ["Menos calor humano no atendimento", "Pode soar seco no telefone"],
  },
  analitico: {
    nome: "O Analista", tag: "Perfil C", dim: "C", cor: "#3B6FB0", base: 55,
    resumo: "Detalhista, organizado e preciso. Decide com base em dados e preza qualidade e processo.",
    plain: "Caprichoso, organizado e atento ao detalhe. Gosta de fazer tudo certo, sem erro. Ótimo com regras, cadastro e conferência.",
    forcas: ["Precisão e organização", "Segue script à risca", "Ótimo com dados/CRM"],
    atencao: ["Ritmo mais lento na ponta", "Melhor em retaguarda/cadastro do que no telefone"],
  },
} as const;

export const ORDEM_PERFIS: PerfilKey[] = ["comunicador", "fechador", "diplomatico", "executor", "analitico"];

export const DIM_INFO: Record<Dim, { nome: string; cor: string; plain: string }> = {
  D: { nome: "Dominância", cor: "#C0392B", plain: "O quanto a pessoa é determinada e gosta de assumir o comando. Quanto maior, mais direta, decidida e movida por desafios e resultado." },
  I: { nome: "Influência", cor: LARANJA, plain: "O quanto a pessoa é comunicativa e sociável. Quanto maior, mais facilidade para conversar, convencer e se conectar com gente." },
  S: { nome: "Estabilidade", cor: "#2E8B7A", plain: "O quanto a pessoa é calma, paciente e constante. Quanto maior, melhor ouvinte, mais colaborativa e firme na rotina." },
  C: { nome: "Conformidade", cor: "#3B6FB0", plain: "O quanto a pessoa é organizada e atenta a detalhes. Quanto maior, mais caprichosa e cuidadosa com regras e qualidade." },
};

export const COR_RACA = ["Branca", "Preta", "Parda", "Amarela", "Indígena", "Prefiro não responder"];
export const GENERO = ["Mulher cisgênero", "Homem cisgênero", "Mulher transgênero", "Homem transgênero", "Não-binário", "Outro", "Prefiro não responder"];
export const ORIENTACAO = ["Heterossexual", "Homossexual", "Bissexual", "Pansexual", "Outra", "Prefiro não responder"];
export const PCD = ["Sim", "Não", "Prefiro não responder"];
export const POLITICO = ["Esquerda", "Centro-esquerda", "Centro", "Centro-direita", "Direita", "Apartidário(a)", "Prefiro não responder"];

export const NIVEL_HAB: NivelHab[] = ["essencial", "importante", "desejavel"];
export const corHab = (n: string) => (n === "essencial" ? VERMELHO : n === "importante" ? LARANJA : "#7C7791");
export const txtHab = (n: string) => (n === "essencial" ? "Essencial" : n === "importante" ? "Importante" : "Desejável");
export const rotuloPeso = (v: number): [string, string] =>
  v >= 90 ? ["Ideal", VERDE] : v >= 70 ? ["Bom", LARANJA] : v >= 50 ? ["Aceitável", AMARELO] : ["Evitar", "#9b93b0"];

export const labelMatch = (m: number) => (m >= 85 ? "Altíssimo" : m >= 70 ? "Alto" : m >= 55 ? "Médio" : "Baixo");
export const corMatch = (m: number) => (m >= 85 ? VERDE : m >= 70 ? LARANJA : m >= 55 ? AMARELO : VERMELHO);
export const corNivel = (n?: string) => (n === "alta" ? VERDE : n === "media" ? LARANJA : "#9b93b0");
export const txtNivel = (n?: string) => (n === "alta" ? "Alta" : n === "media" ? "Média" : "Baixa");
export const corStatus = (s: string) => (s === "Aberta" ? VERDE : s === "Rascunho" ? "#9b93b0" : s === "Pausada" ? AMARELO : "#C0392B");

export const fmtData = (iso?: string | null) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "");

export type VagaPesos = Record<PerfilKey, number>;
export type DiscOpcao = { dim: Dim; txt: string };
export type DiscBlock = { opcoes: DiscOpcao[] };
export type SitOpcao = { txt: string; pts: number };
export type Situacao = { titulo: string; options: SitOpcao[] };

export type Vaga = {
  id: string;
  empresa_id?: string;
  unidade_id?: string;
  titulo: string;
  setor: string;
  modelo: string;
  tipo: string;
  vagas: number;
  status: string;
  descricao: string;
  data_limite: string | null;
  link_token: string;
  pesos: VagaPesos;
  habilidades: { nome: string; nivel: NivelHab }[];
  competencias: string[];
  experiencia: string;
  escolaridade: string;
  requisitos: string;
  usar_situacional: boolean;
  disc_blocks: DiscBlock[];
  situacoes: Situacao[];
  formulario_aprovado: boolean;
  interna: boolean;
  motivo: string;
  created_at?: string;
};

export function efetivamenteEncerrada(v: { status: string; data_limite: string | null }) {
  if (v.status === "Fechada") return true;
  if (v.data_limite) return new Date() > new Date(v.data_limite + "T23:59:59");
  return false;
}
export function statusVaga(v: { status: string; data_limite: string | null }): { label: string; cor: string } {
  if (efetivamenteEncerrada(v)) return { label: v.data_limite && v.status !== "Fechada" ? "Encerrada (prazo)" : "Encerrada", cor: VERMELHO };
  return { label: v.status, cor: corStatus(v.status) };
}

export const novaVagaVazia = (): Omit<Vaga, "id" | "link_token"> & { link_token?: string } => ({
  titulo: "", setor: "", modelo: "Presencial", tipo: "Efetivo", vagas: 1, status: "Rascunho",
  descricao: "", data_limite: null,
  pesos: { comunicador: 50, fechador: 50, diplomatico: 50, executor: 50, analitico: 50 },
  habilidades: [], competencias: [], experiencia: "", escolaridade: "", requisitos: "",
  usar_situacional: true,
  disc_blocks: [], situacoes: [], formulario_aprovado: false,
  interna: true,
  motivo: "",
});

/* ========== VALIDAÇÃO ========== */
export function validateDiscBlocks(blocos: any): blocos is DiscBlock[] {
  if (!Array.isArray(blocos) || blocos.length < 5 || blocos.length > 7) return false;
  for (const b of blocos) {
    const ops = b?.opcoes;
    if (!Array.isArray(ops) || ops.length !== 4) return false;
    const dims = new Set(ops.map((o: any) => o?.dim));
    if (dims.size !== 4 || !["D","I","S","C"].every((d) => dims.has(d))) return false;
    if (!ops.every((o: any) => typeof o?.txt === "string" && o.txt.trim().length > 0)) return false;
  }
  return true;
}
export function validateSituacoes(s: any): s is Situacao[] {
  if (!Array.isArray(s)) return false;
  return s.every((q: any) =>
    typeof q?.titulo === "string" && Array.isArray(q?.options) && q.options.length === 4 &&
    q.options.every((o: any) => typeof o?.txt === "string" && typeof o?.pts === "number")
  );
}
export function getDiscBlocks(v: { disc_blocks?: any } | null | undefined): DiscBlock[] {
  if (v && validateDiscBlocks(v.disc_blocks)) return v.disc_blocks as DiscBlock[];
  return DISC_BLOCKS;
}
export function getSituacoes(v: { situacoes?: any } | null | undefined): Situacao[] {
  if (v && Array.isArray(v.situacoes) && v.situacoes.length > 0 && validateSituacoes(v.situacoes)) return v.situacoes as Situacao[];
  return [];
}

/* ========== CÁLCULO ========== */
export function computeResults(a: Record<string, any>, vaga?: { pesos: VagaPesos; disc_blocks?: any; situacoes?: any; usar_situacional?: boolean } | null) {
  const blocks = getDiscBlocks(vaga ?? null);
  const sitList = vaga?.usar_situacional === false ? [] : getSituacoes(vaga ?? null);

  const disc: Record<Dim, number> = { D: 0, I: 0, S: 0, C: 0 };
  blocks.forEach((b, bi) => {
    const mais = a["disc_" + bi + "_mais"];
    const menos = a["disc_" + bi + "_menos"];
    if (mais !== undefined) disc[b.opcoes[mais].dim] += 1;
    if (menos !== undefined) disc[b.opcoes[menos].dim] -= 1;
  });
  const N = blocks.length;
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

  let sitAvg: number = PERFIS[key].base;
  let usouSit = false;
  if (sitList.length > 0) {
    const vals = sitList.map((q, i) => {
      const ans = a["sit_" + i];
      if (typeof ans !== "string") return null;
      const idx = Number(ans.replace(/^o/, ""));
      const opt = q.options[idx];
      return opt ? opt.pts : null;
    });
    const respondidas = vals.filter((v) => v !== null) as number[];
    if (respondidas.length > 0) {
      usouSit = true;
      sitAvg = Math.round(respondidas.reduce((s, v) => s + v, 0) / sitList.length);
    }
  }

  const base = vaga?.pesos?.[key] ?? PERFIS[key].base;
  const finalMatch = usouSit ? Math.round(base * 0.6 + sitAvg * 0.4) : base;
  const label = labelMatch(finalMatch);

  return { disc, discPct, key, perfil: PERFIS[key], primary, secondary, sitAvg, finalMatch, label, blocks, sitList };
}

export const cvScoreDe = (cv: any): number | null => {
  if (!cv || typeof cv !== "object") return null;
  const ader = String(cv.aderencia_televendas ?? "").toLowerCase();
  let base = ader === "alta" ? 100 : ader === "media" || ader === "média" ? 65 : ader === "baixa" ? 30 : 50;
  const lacunas: string[] = Array.isArray(cv.lacunas) ? cv.lacunas : [];
  // Penaliza ausência/falta de experiência relevante (vaga exige vivência)
  const regexExp = /(aus[êe]ncia|falta|sem|pouca|nenhuma|baixa)[^.]{0,40}(experi[êe]ncia|viv[êe]ncia)/i;
  let penal = 0;
  for (const l of lacunas) {
    const txt = String(l ?? "");
    if (regexExp.test(txt)) penal += 18;
    else penal += 6;
  }
  penal = Math.min(penal, 45);
  return Math.max(0, Math.min(100, base - penal));
};

export const matchDe = (
  vaga: { pesos: VagaPesos } | null | undefined,
  c: { perfil_key: string | null; postura_score: number | null; cv_analise?: any },
) => {
  const base = (vaga?.pesos as any)?.[c.perfil_key ?? ""] ?? 50;
  const postura = c.postura_score ?? 0;
  const cv = cvScoreDe(c.cv_analise);
  if (cv === null) return Math.round(base * 0.6 + postura * 0.4);
  return Math.round(base * 0.45 + postura * 0.3 + cv * 0.25);
};
