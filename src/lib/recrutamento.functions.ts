import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Análise de currículo via Lovable AI Gateway (Gemini).
// Aceita PDF/imagem (base64 + mime) ou texto bruto (.docx já extraído no cliente, ou descrição).
const AnalyzeInput = z.object({
  storagePath: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  textoExtra: z.string().optional().default(""),
  textoBruto: z.string().nullable().optional(),
});

const INSTRUCAO = `Você é analista de RH. Analise o material a seguir (currículo e/ou descrição de experiência) de um candidato a uma vaga de TELEVENDAS e responda SOMENTE com um objeto JSON válido, sem markdown, sem nenhum texto fora do JSON, exatamente neste formato:
{"resumo":"2 a 3 frases","experiencias":[{"cargo":"","empresa":"","periodo":"","relevancia":"alta|media|baixa"}],"anos_relevantes":"texto curto","pontos_fortes":["",""],"lacunas":["",""],"aderencia_televendas":"alta|media|baixa","perguntas_entrevista":["",""]}
Regras: foque no que importa para televendas (comunicação, vendas, atendimento, persuasão, relacionamento, metas). No máximo 3 experiências mais relevantes, 3 pontos fortes, 3 lacunas e 3 perguntas. Seja conciso. Português do Brasil.`;

export const analisarCv = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    // Construir parts para Gemini via gateway OpenAI-compatible
    const userContent: any[] = [];

    if (data.storagePath && data.mimeType && (data.mimeType === "application/pdf" || data.mimeType.startsWith("image/"))) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: file, error } = await supabaseAdmin.storage.from("curriculos").download(data.storagePath);
      if (error || !file) throw new Error("Falha ao baixar currículo: " + (error?.message ?? "desconhecido"));
      const ab = await file.arrayBuffer();
      const b64 = Buffer.from(ab).toString("base64");
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${data.mimeType};base64,${b64}` },
      });
      userContent.push({ type: "text", text: INSTRUCAO + (data.textoExtra ?? "") });
    } else if (data.textoBruto) {
      userContent.push({ type: "text", text: INSTRUCAO + "\n\nCURRÍCULO (texto extraído):\n" + data.textoBruto + (data.textoExtra ?? "") });
    } else {
      userContent.push({ type: "text", text: INSTRUCAO + "\n\nDESCRIÇÃO FORNECIDA PELO CANDIDATO:\n" + (data.textoExtra || "Nenhuma informação adicional foi fornecida.") });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
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
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Resposta da IA não é JSON válido.");
      parsed = JSON.parse(m[0]);
    }
    return parsed;
  });
