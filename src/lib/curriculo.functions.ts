import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callClaude } from "@/lib/recrutamento.functions";

// Leitura de currículo → pré-preenchimento do formulário de inscrição.
//
// PÚBLICA POR DESIGN (o candidato ainda não tem conta neste ponto do funil).
// Guardas: a vaga precisa aceitar inscrição, e o arquivo precisa estar no
// bucket `curriculos` sob o path da própria vaga (a policy de upload anônimo
// só aceita path de vaga aberta — quem chegou aqui passou por ela).
//
// UMA chamada de IA devolve DUAS coisas:
//  - `formulario`: campos para pré-preencher (nunca inventados — null se não achar);
//  - `analise`: shape idêntico ao cv_analise, para o INSERT final já incluir e
//    PULAR a chamada pós-insert do analisarCv (metade do custo/latência).

const LerInput = z.object({
  vagaId: z.string().uuid(),
  storagePath: z.string().min(5).max(400).nullable().optional(),
  mimeType: z.string().max(120).nullable().optional(),
  textoBruto: z.string().max(20000).nullable().optional(),
});

const MAX_ARQUIVO_MB = 8;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Converte um arquivo de currículo em blocos multimodais para a IA:
 * PDF → document block, imagem → image block, DOCX → texto via mammoth.
 * Compartilhado entre o funil público (lerCurriculo) e o perfil neutro
 * (estruturarMeuPerfil / currículo da conta).
 */
export async function extrairConteudoCv(
  ab: ArrayBuffer,
  mime: string,
  nomeOuPath: string,
): Promise<any[]> {
  if (mime === "application/pdf") {
    return [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: Buffer.from(ab).toString("base64"),
        },
      },
    ];
  }
  if (mime.startsWith("image/")) {
    return [
      {
        type: "image",
        source: { type: "base64", media_type: mime, data: Buffer.from(ab).toString("base64") },
      },
    ];
  }
  if (mime === DOCX_MIME || nomeOuPath.toLowerCase().endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(ab) });
    if (value?.trim()) {
      return [{ type: "text", text: "CURRÍCULO (texto extraído):\n" + value.slice(0, 20000) }];
    }
  }
  // .doc antigo e outros: sem extração confiável.
  return [];
}

export const lerCurriculo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LerInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: aceita } = await admin.rpc("vaga_aceita_inscricao", { _vaga_id: data.vagaId });
    if (aceita !== true) throw new Error("Esta vaga não está recebendo inscrições.");

    const { data: vaga } = await admin
      .from("vagas")
      .select("id, empresa_id, titulo, setor, descricao, experiencia, escolaridade, requisitos")
      .eq("id", data.vagaId)
      .maybeSingle();
    if (!vaga) throw new Error("Vaga não encontrada.");

    // Conteúdo multimodal para a IA (mesmo padrão do analisarCv).
    const userContent: any[] = [];
    if (data.storagePath) {
      const prefixo = `${vaga.empresa_id}/${vaga.id}/`;
      if (!data.storagePath.startsWith(prefixo) || data.storagePath.includes("..")) {
        throw new Error("Caminho de arquivo inválido.");
      }
      const { data: file, error } = await admin.storage
        .from("curriculos")
        .download(data.storagePath);
      if (error || !file) throw new Error("Não foi possível ler o arquivo enviado.");
      const ab = await file.arrayBuffer();
      if (ab.byteLength > MAX_ARQUIVO_MB * 1024 * 1024) throw new Error("Arquivo grande demais.");
      userContent.push(...(await extrairConteudoCv(ab, data.mimeType ?? "", data.storagePath)));
    }
    if (data.textoBruto?.trim()) {
      userContent.push({
        type: "text",
        text: "TEXTO INFORMADO PELO CANDIDATO:\n" + data.textoBruto,
      });
    }
    if (userContent.length === 0) {
      throw new Error("Nada para ler — envie um PDF, imagem ou DOCX.");
    }

    const ctx = [
      `Vaga: ${vaga.titulo ?? ""} (${vaga.setor ?? "geral"})`,
      vaga.descricao ? `Descrição: ${String(vaga.descricao).slice(0, 600)}` : "",
      vaga.requisitos ? `Requisitos: ${String(vaga.requisitos).slice(0, 300)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    userContent.push({
      type: "text",
      text: `Você é analista de RH. Leia o currículo acima e devolva SOMENTE um objeto JSON válido, sem markdown, exatamente neste formato:
{"formulario":{"nome":null,"email":null,"celular":null,"endereco":null,"setor_atual":null,"tempo_empresa":null,"experiencia_texto":null},"analise":{"resumo":"2 a 3 frases","experiencias":[{"cargo":"","empresa":"","periodo":"","relevancia":"alta|media|baixa"}],"anos_relevantes":"texto curto","pontos_fortes":["",""],"lacunas":["",""],"aderencia_televendas":"alta|media|baixa","perguntas_entrevista":["",""]}}

CONTEXTO DA VAGA:\n${ctx}

Regras do "formulario": preencha APENAS com o que estiver escrito no currículo — NUNCA invente; campo não encontrado fica null. "celular" no formato brasileiro se houver. "endereco" = bairro/cidade se houver. "setor_atual" = área/função atual. "tempo_empresa" = tempo no emprego atual se houver. "experiencia_texto" = resumo em 1ª pessoa (2-3 frases, tom simples) da experiência relevante para a vaga.
Regras da "analise": foque na vaga; máx. 3 experiências/pontos fortes/lacunas/perguntas; conciso; português do Brasil; "aderencia_televendas" = aderência à vaga (nome mantido por compatibilidade).`,
    });

    const resultado = await callClaude(userContent);
    // Sanitiza: só os campos esperados saem (allowlist).
    const f = resultado?.formulario ?? {};
    const a = resultado?.analise ?? null;
    return {
      formulario: {
        nome: f.nome ?? null,
        email: f.email ?? null,
        celular: f.celular ?? null,
        endereco: f.endereco ?? null,
        setor_atual: f.setor_atual ?? null,
        tempo_empresa: f.tempo_empresa ?? null,
        experiencia_texto: f.experiencia_texto ?? null,
      },
      analise: a,
    };
  });
