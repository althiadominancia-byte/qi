import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, assertEscopoCandidato } from "@/lib/tenant.server";

// Vídeo-pitch — lado do STAFF: assistir + ler transcrição/análise de CONTEÚDO.
// A análise é apoio à decisão HUMANA (nunca elimina automaticamente) e cobre
// apenas o que foi dito — jamais aparência/emoção/sotaque (regra de produto).

const CandId = z.object({ candidatoId: z.string().uuid() });

/** Vídeo do candidato p/ o painel: URL assinada + transcrição + análise. */
export const getVideoCandidato = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "ver_candidatos");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: video } = await admin
      .from("candidato_videos")
      .select("id, storage_path, duracao_s, transcricao, analise, consentiu_em, versao_termo, created_at")
      .eq("candidato_id", data.candidatoId)
      .maybeSingle();
    if (!video) return null;
    const { data: signed } = await admin.storage
      .from("videos")
      .createSignedUrl(video.storage_path, 300);
    return {
      url: signed?.signedUrl ?? null,
      duracao_s: video.duracao_s,
      transcricao: video.transcricao,
      analise: video.analise,
      consentiu_em: video.consentiu_em,
      versao_termo: video.versao_termo,
      created_at: video.created_at,
      processado: !!video.transcricao,
    };
  });

/** Re-roda transcrição + análise (ex.: STT configurado depois do envio). */
export const reprocessarVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "ver_candidatos");
    const cand = await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: video } = await admin
      .from("candidato_videos")
      .select("id, storage_path")
      .eq("candidato_id", data.candidatoId)
      .maybeSingle();
    if (!video) throw new Error("Este candidato não enviou vídeo.");

    const { data: file, error: dErr } = await admin.storage.from("videos").download(video.storage_path);
    if (dErr || !file) throw new Error("Não foi possível ler o vídeo.");
    const { transcreverAudio } = await import("@/lib/stt.server");
    const transcricao = await transcreverAudio(await file.arrayBuffer(), "pitch.webm");

    const { callClaude } = await import("@/lib/recrutamento.functions");
    const analise = await callClaude([
      {
        type: "text",
        text: `Você é analista de RH. Abaixo, a TRANSCRIÇÃO do vídeo de apresentação de um(a) profissional (perfil NEUTRO — não cite nem presuma nenhuma vaga).

REGRAS INEGOCIÁVEIS: analise SOMENTE o conteúdo falado. NÃO infira nem comente aparência, emoção, sotaque, idade, gênero ou característica pessoal. Apoio à decisão humana.

Responda SOMENTE com JSON válido neste formato:
{"resumo":"2 frases sobre o que a pessoa comunicou","comunicacao":"forte|media|fraca","comunicacao_justificativa":"1 frase sobre clareza/estrutura DO DISCURSO","pontos_fortes":["",""],"atencao":["",""],"perguntas_entrevista":["",""]}
Máximo 3 itens por lista. Português do Brasil.

TRANSCRIÇÃO:\n${transcricao.slice(0, 8000)}`,
      },
    ]);
    const { error } = await admin
      .from("candidato_videos")
      .update({ transcricao, analise })
      .eq("id", video.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
