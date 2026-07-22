import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm } from "@/lib/tenant.server";

const AnalyzeInput = z.object({
  candidatoId: z.string().uuid().optional(),
  storagePath: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  textoExtra: z.string().optional().default(""),
  textoBruto: z.string().nullable().optional(),
  vagaContexto: z.string().optional().default(""),
});

// IA via API da Anthropic (SDK oficial). Import dinâmico => server-only (não vai
// para o bundle do cliente). Espera JSON no texto da resposta.
async function callClaude(userContent: any[]) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ausente");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  let resp: any;
  try {
    resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      messages: [{ role: "user", content: userContent }],
    });
  } catch (e: any) {
    if (e?.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em alguns minutos.");
    if (e?.status === 401 || e?.status === 403) throw new Error("Chave da IA inválida ou sem permissão.");
    throw new Error("Falha na IA: " + String(e?.message ?? e).slice(0, 200));
  }
  const text = (resp.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Resposta da IA não é JSON válido.");
    return JSON.parse(m[0]);
  }
}

// PÚBLICA POR DESIGN: chamada pelo formulário do candidato (não autenticado).
// Protegida pelas guardas internas — o cv_storage_path precisa bater com a
// inscrição e a vaga precisa aceitar inscrição (vaga_aceita_inscricao).
export const analisarCv = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data }) => {
    const ctx = data.vagaContexto ? `\n\nCONTEXTO DA VAGA:\n${data.vagaContexto}` : " (Vaga genérica de atendimento/vendas).";
    const INSTRUCAO = `Você é analista de RH. Analise o material a seguir (currículo e/ou descrição de experiência) de um candidato${ctx}\n\nResponda SOMENTE com um objeto JSON válido, sem markdown, sem nenhum texto fora do JSON, exatamente neste formato:
{"resumo":"2 a 3 frases","experiencias":[{"cargo":"","empresa":"","periodo":"","relevancia":"alta|media|baixa"}],"anos_relevantes":"texto curto","pontos_fortes":["",""],"lacunas":["",""],"aderencia_televendas":"alta|media|baixa","perguntas_entrevista":["",""]}
Regras: foque no que importa para a vaga. No máximo 3 experiências mais relevantes, 3 pontos fortes, 3 lacunas e 3 perguntas. Seja conciso. Português do Brasil. O campo "aderencia_televendas" representa a aderência à vaga (mantido o nome por compatibilidade).`;

    const userContent: any[] = [];
    if (data.storagePath && data.mimeType && (data.mimeType === "application/pdf" || data.mimeType.startsWith("image/"))) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: file, error } = await supabaseAdmin.storage.from("curriculos").download(data.storagePath);
      if (error || !file) throw new Error("Falha ao baixar currículo: " + (error?.message ?? "desconhecido"));
      const ab = await file.arrayBuffer();
      const b64 = Buffer.from(ab).toString("base64");
      // Blocos multimodais no formato da Anthropic (documento p/ PDF, imagem p/ o resto).
      if (data.mimeType === "application/pdf") {
        userContent.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
      } else {
        userContent.push({ type: "image", source: { type: "base64", media_type: data.mimeType, data: b64 } });
      }
      userContent.push({ type: "text", text: INSTRUCAO + (data.textoExtra ?? "") });
    } else if (data.textoBruto) {
      userContent.push({ type: "text", text: INSTRUCAO + "\n\nCURRÍCULO (texto extraído):\n" + data.textoBruto + (data.textoExtra ?? "") });
    } else {
      userContent.push({ type: "text", text: INSTRUCAO + "\n\nDESCRIÇÃO FORNECIDA PELO CANDIDATO:\n" + (data.textoExtra || "Nenhuma informação adicional foi fornecida.") });
    }
    const analysis = await callClaude(userContent);
    if (data.candidatoId && data.storagePath) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: candidato, error: candError } = await supabaseAdmin
        .from("candidatos_televendas")
        .select("id, vaga_id, cv_storage_path")
        .eq("id", data.candidatoId)
        .maybeSingle();
      if (candError || !candidato) throw new Error("Inscrição não encontrada para salvar a análise.");
      if (!candidato.vaga_id) throw new Error("Inscrição sem vaga vinculada.");
      if ((candidato.cv_storage_path ?? null) !== (data.storagePath ?? null)) {
        throw new Error("Currículo não confere com a inscrição enviada.");
      }
      const { data: vagaAberta, error: vagaError } = await supabaseAdmin.rpc("vaga_aceita_inscricao", { _vaga_id: candidato.vaga_id });
      if (vagaError || !vagaAberta) throw new Error("Vaga não está aberta para análise automática.");
      const { error } = await supabaseAdmin
        .from("candidatos_televendas")
        .update({ cv_analise: analysis })
        .eq("id", data.candidatoId);
      if (error) throw new Error("Falha ao salvar análise do currículo: " + error.message);
    }
    return analysis;
  });

const GerarVagaInput = z.object({
  titulo: z.string().min(1),
  setor: z.string().optional().default(""),
  modelo: z.string().optional().default(""),
  tipo: z.string().optional().default(""),
  descricao: z.string().optional().default(""),
});

export const gerarPerfilVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GerarVagaInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertPerm((context as any).userId, "gerenciar_vagas");
    const prompt = `Você é especialista em RH. Com base nos dados de uma vaga, gere um PERFIL recomendado para preenchê-la e também uma DESCRIÇÃO reescrita, mais clara, organizada e fácil de entender, para ficar no topo do formulário. Responda SOMENTE com JSON válido, sem markdown, neste formato:
{"descricao":"texto reescrito da vaga","pesos":{"comunicador":0,"fechador":0,"diplomatico":0,"executor":0,"analitico":0},"habilidades":[{"nome":"","nivel":"essencial|importante|desejavel"}],"competencias":["",""],"experiencia":"texto curto","escolaridade":"texto curto","requisitos":"texto curto"}

Sobre o campo "descricao":
- Reescreva a descrição original deixando-a mais clara, profissional e organizada, sem inventar informações que não estejam nos dados fornecidos.
- Use parágrafos curtos e, quando fizer sentido, listas com "- " (hífen) para responsabilidades, requisitos e benefícios.
- Estruture preferencialmente em blocos: breve resumo da vaga, principais responsabilidades, requisitos/qualificações, e detalhes (carga horária, jornada, local, veículo, CNH etc.) quando informados.
- Mantenha o tom objetivo, em português do Brasil, sem chavões corporativos vazios. Não invente salário, benefícios nem nome de empresa.

Os pesos (0–100) indicam o quanto cada perfil comportamental é ideal para ESTA vaga:
- comunicador (perfil I): comunicação, persuasão, sociável, energia.
- fechador (perfil D/I): negociação, liderança, foco em resultado com influência.
- diplomatico (perfil I/S): paciência, escuta, colaboração, relacionamento.
- executor (perfil D): decisão rápida, produtividade, foco em entrega.
- analitico (perfil C): precisão, organização, regras, qualidade, dados.
Notas coerentes com a função (ex.: vendas → comunicador/fechador altos; conferência/técnico → analitico/executor altos). No máximo 7 habilidades e 5 competências. Português do Brasil. Seja conciso.

DADOS DA VAGA:
Título: ${data.titulo}
Setor/área: ${data.setor || "-"}
Modelo: ${data.modelo} | Tipo: ${data.tipo}
Descrição: ${data.descricao || "(não informada)"}`;


    return callClaude([{ type: "text", text: prompt }]);
  });

const GerarFormularioInput = z.object({
  titulo: z.string().min(1),
  setor: z.string().optional().default(""),
  descricao: z.string().optional().default(""),
  modelo: z.string().optional().default(""),
  tipo: z.string().optional().default(""),
  experiencia: z.string().optional().default(""),
  escolaridade: z.string().optional().default(""),
  requisitos: z.string().optional().default(""),
  habilidades: z.array(z.any()).optional().default([]),
  competencias: z.array(z.any()).optional().default([]),
  pesos: z.record(z.string(), z.number()).optional().default({}),
  modo: z.enum(["ambos", "disc", "situacoes"]).optional().default("ambos"),
  usar_situacional: z.boolean().optional().default(true),
});

function ctxVaga(d: any): string {
  const habs = Array.isArray(d.habilidades) && d.habilidades.length
    ? d.habilidades.map((h: any) => typeof h === "string" ? h : `${h?.nome ?? ""}${h?.nivel ? ` (${h.nivel})` : ""}`).filter(Boolean).join(", ")
    : "(não informadas)";
  const comps = Array.isArray(d.competencias) && d.competencias.length ? d.competencias.join(", ") : "(não informadas)";
  const pesos = d.pesos && Object.keys(d.pesos).length
    ? Object.entries(d.pesos).map(([k, v]) => `${k}:${v}`).join(", ")
    : "(padrão)";
  return `Título: ${d.titulo}
Setor/área: ${d.setor || "-"}
Modelo: ${d.modelo || "-"} | Tipo: ${d.tipo || "-"}
Experiência exigida: ${d.experiencia || "-"}
Escolaridade: ${d.escolaridade || "-"}
Requisitos: ${d.requisitos || "-"}
Habilidades-chave: ${habs}
Competências esperadas: ${comps}
Perfil comportamental ideal (pesos 0-100): ${pesos}
Descrição da vaga:
${d.descricao || "(não informada)"}`;
}

const PROMPT_DISC = (d: any) => `Você é especialista em DISC (Marston) aplicado à seleção. Gere blocos de DISC FORÇADO (ipsativo) ALTAMENTE ADAPTADOS ao vocabulário, rotina e desafios reais da vaga descrita abaixo. NÃO use frases genéricas — cada frase deve soar como algo que um profissional dessa função realmente diria sobre seu jeito de trabalhar no contexto específico (clientes, produtos, ferramentas, equipe, pressões típicas).

ESTRUTURA INEGOCIÁVEL (não altere):
- Gere EXATAMENTE 6 blocos.
- Cada bloco tem EXATAMENTE 4 frases, UMA de cada dimensão: D (Dominância), I (Influência), S (Estabilidade), C (Conformidade).
- TODAS as 4 frases POSITIVAS, socialmente desejáveis e EQUILIBRADAS — nenhuma pode parecer "obviamente a melhor". Evite palavras-armadilha negativas.
- Cada frase: 1ª pessoa, 8 a 16 palavras, vocabulário cotidiano do setor da vaga, CONCRETA (cita situação/objeto/pessoa real da rotina), sem chavões corporativos vazios ("proativo", "sinérgico").
- Os 6 blocos devem cobrir contextos DIFERENTES da rotina (ex.: cliente difícil, prazo apertado, mudança de regra, conflito de equipe, decisão sob pressão, organização do próprio trabalho).
- Português do Brasil, sem markdown.

Responda SOMENTE com JSON válido neste formato exato:
{"blocos":[{"opcoes":[{"dim":"D","txt":""},{"dim":"I","txt":""},{"dim":"S","txt":""},{"dim":"C","txt":""}]}]}

CONTEXTO DA VAGA:
${ctxVaga(d)}`;

const PROMPT_SIT = (d: any) => `Você é especialista em avaliação situacional (SJT) para seleção. Gere situações REAIS, ESPECÍFICAS e desafiadoras do dia a dia desta vaga — nada de cenários genéricos. Cada situação deve referenciar elementos concretos da função (clientes, ferramentas, prazos, regras, colegas, gestores) e colocar o candidato diante de um dilema verossímil.

ESTRUTURA:
- Gere EXATAMENTE 4 situações.
- O campo "titulo" deve conter o ENUNCIADO completo da situação: 2 a 4 frases, 60 a 150 palavras, descrevendo cenário, envolvidos e a decisão que precisa ser tomada agora. (Pode começar com um título curto seguido de ":" e depois o enunciado.)
- Cada situação tem EXATAMENTE 4 opções pontuadas: 100 (melhor postura), 70 (boa), 40 (fraca), 15 (ruim/risco real para o negócio).
- Cada opção é uma AÇÃO concreta e plausível, 15 a 30 palavras. As 4 opções devem soar plausíveis — a errada não pode ser caricata.
- Cubra ao longo das 4 situações: atendimento sob pressão, ética/integridade, autonomia vs. seguir processo, conflito interpessoal ou erro próprio/de colega.
- Nada discriminatório, ilegal ou que peça dados sensíveis. Português do Brasil.

Responda SOMENTE com JSON válido, sem markdown:
{"situacoes":[{"titulo":"","options":[{"txt":"","pts":100},{"txt":"","pts":70},{"txt":"","pts":40},{"txt":"","pts":15}]}]}

CONTEXTO DA VAGA:
${ctxVaga(d)}`;

function validaDisc(j: any): boolean {
  const b = j?.blocos;
  if (!Array.isArray(b) || b.length < 5 || b.length > 7) return false;
  for (const bl of b) {
    const ops = bl?.opcoes;
    if (!Array.isArray(ops) || ops.length !== 4) return false;
    const dims = new Set(ops.map((o: any) => o?.dim));
    if (dims.size !== 4 || !["D","I","S","C"].every((d) => dims.has(d))) return false;
    if (!ops.every((o: any) => typeof o?.txt === "string" && o.txt.trim().length > 0)) return false;
  }
  return true;
}
function validaSit(j: any): boolean {
  const s = j?.situacoes;
  if (!Array.isArray(s) || s.length < 3 || s.length > 4) return false;
  return s.every((q: any) =>
    typeof q?.titulo === "string" && q.titulo.trim() &&
    Array.isArray(q?.options) && q.options.length === 4 &&
    q.options.every((o: any) => typeof o?.txt === "string" && o.txt.trim() && typeof o?.pts === "number")
  );
}

const DISC_FALLBACK = [
  { opcoes: [{ dim: "D", txt: "Decidido(a), resolvo as coisas rápido" }, { dim: "I", txt: "Comunicativo(a), falo com facilidade" }, { dim: "S", txt: "Paciente, mantenho a calma" }, { dim: "C", txt: "Caprichoso(a) com os detalhes" }] },
  { opcoes: [{ dim: "I", txt: "Gosto de animar e influenciar as pessoas" }, { dim: "C", txt: "Gosto de fazer tudo certo e organizado" }, { dim: "D", txt: "Gosto de assumir o comando" }, { dim: "S", txt: "Gosto de apoiar a equipe" }] },
  { opcoes: [{ dim: "S", txt: "Foco na harmonia do grupo" }, { dim: "D", txt: "Foco no resultado" }, { dim: "C", txt: "Foco na qualidade" }, { dim: "I", txt: "Foco nas pessoas" }] },
  { opcoes: [{ dim: "C", txt: "Sou cuidadoso(a) e ponderado(a)" }, { dim: "S", txt: "Sou tranquilo(a) e estável" }, { dim: "I", txt: "Sou entusiasmado(a) e animado(a)" }, { dim: "D", txt: "Sou direto(a) e objetivo(a)" }] },
  { opcoes: [{ dim: "D", txt: "Encaro desafios de frente" }, { dim: "S", txt: "Escuto com atenção antes de agir" }, { dim: "I", txt: "Convenço as pessoas pelo meu jeito" }, { dim: "C", txt: "Analiso tudo antes de decidir" }] },
  { opcoes: [{ dim: "I", txt: "Gosto de socializar e conhecer gente" }, { dim: "S", txt: "Gosto de colaborar com todos" }, { dim: "C", txt: "Gosto de planejar antes de agir" }, { dim: "D", txt: "Gosto de liderar e decidir" }] },
];

export const gerarFormularioVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GerarFormularioInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertPerm((context as any).userId, "gerenciar_vagas");
    const out: { disc_blocks?: any[]; situacoes?: any[]; disc_fallback?: boolean } = {};

    if (data.modo === "ambos" || data.modo === "disc") {
      let disc: any = null;
      for (let i = 0; i < 2; i++) {
        try {
          const j = await callClaude([{ type: "text", text: PROMPT_DISC(data) }]);
          if (validaDisc(j)) { disc = j.blocos; break; }
        } catch {}
      }
      if (!disc) { disc = DISC_FALLBACK; out.disc_fallback = true; }
      out.disc_blocks = disc;
    }

    if ((data.modo === "ambos" || data.modo === "situacoes") && data.usar_situacional) {
      let sit: any = null;
      for (let i = 0; i < 2; i++) {
        try {
          const j = await callClaude([{ type: "text", text: PROMPT_SIT(data) }]);
          if (validaSit(j)) { sit = j.situacoes; break; }
        } catch {}
      }
      out.situacoes = sit ?? [];
    } else if (data.modo === "ambos") {
      out.situacoes = [];
    }

    return out;
  });

const ExcluirInput = z.object({ vagaId: z.string().uuid() });

export const excluirVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExcluirInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin.from("usuarios").select("role, ativo").eq("id", userId).maybeSingle();
    if (!me?.ativo) throw new Error("Usuário não autorizado.");
    if (me.role !== "super_admin") throw new Error("Apenas Super Admin pode excluir vagas.");
    const { error } = await supabaseAdmin.from("vagas").delete().eq("id", data.vagaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
