import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AnalyzeInput = z.object({
  storagePath: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  textoExtra: z.string().optional().default(""),
  textoBruto: z.string().nullable().optional(),
  vagaContexto: z.string().optional().default(""),
});

async function callGemini(userContent: any[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em alguns minutos.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    throw new Error("Falha na IA: " + txt.slice(0, 200));
  }
  const json = await resp.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Resposta da IA não é JSON válido.");
    return JSON.parse(m[0]);
  }
}

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
      userContent.push({ type: "image_url", image_url: { url: `data:${data.mimeType};base64,${b64}` } });
      userContent.push({ type: "text", text: INSTRUCAO + (data.textoExtra ?? "") });
    } else if (data.textoBruto) {
      userContent.push({ type: "text", text: INSTRUCAO + "\n\nCURRÍCULO (texto extraído):\n" + data.textoBruto + (data.textoExtra ?? "") });
    } else {
      userContent.push({ type: "text", text: INSTRUCAO + "\n\nDESCRIÇÃO FORNECIDA PELO CANDIDATO:\n" + (data.textoExtra || "Nenhuma informação adicional foi fornecida.") });
    }
    return callGemini(userContent);
  });

const GerarVagaInput = z.object({
  titulo: z.string().min(1),
  setor: z.string().optional().default(""),
  modelo: z.string().optional().default(""),
  tipo: z.string().optional().default(""),
  descricao: z.string().optional().default(""),
});

export const gerarPerfilVaga = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GerarVagaInput.parse(d))
  .handler(async ({ data }) => {
    const prompt = `Você é especialista em RH. Com base nos dados de uma vaga, gere um PERFIL recomendado para preenchê-la, deixando quase pronto para ajustes. Responda SOMENTE com JSON válido, sem markdown, neste formato:
{"pesos":{"comunicador":0,"fechador":0,"diplomatico":0,"executor":0,"analitico":0},"habilidades":[{"nome":"","nivel":"essencial|importante|desejavel"}],"competencias":["",""],"experiencia":"texto curto","escolaridade":"texto curto","requisitos":"texto curto"}

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

    return callGemini([{ type: "text", text: prompt }]);
  });
