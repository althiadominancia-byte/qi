// Transcrição de áudio/vídeo (STT) via Groq Whisper — server-only.
//
// Um único ponto de STT para a plataforma: transcreve o vídeo-pitch do
// candidato hoje e as gravações LiveKit das entrevistas na Fase 2.
// Requer GROQ_API_KEY no ambiente (console.groq.com). Sem chave => erro claro
// e o chamador decide degradar (ex.: vídeo salvo sem análise).

const GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_STT_MODEL = "whisper-large-v3";

export async function transcreverAudio(bytes: ArrayBuffer, filename: string): Promise<string> {
  // process.env DENTRO da função (Cloudflare vincula o env por requisição).
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("Transcrição não configurada (GROQ_API_KEY ausente no ambiente).");
  }
  const form = new FormData();
  form.append("file", new Blob([bytes]), filename);
  form.append("model", GROQ_STT_MODEL);
  form.append("language", "pt");
  form.append("response_format", "text");

  const res = await fetch(GROQ_STT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Limite de transcrição atingido. Tente em instantes.");
    if (res.status === 401 || res.status === 403) throw new Error("Chave de transcrição inválida.");
    throw new Error("Falha na transcrição: HTTP " + res.status + " " + corpo.slice(0, 120));
  }
  const texto = (await res.text()).trim();
  if (!texto) throw new Error("Transcrição vazia — o vídeo tem áudio?");
  return texto;
}
