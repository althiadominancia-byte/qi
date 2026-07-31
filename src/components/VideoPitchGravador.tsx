import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Check,
  Eye,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import {
  salvarMeuVideo,
  processarMeuVideo,
  urlMeuVideo,
  removerMeuVideo,
  TERMO_VIDEO,
  TERMO_VIDEO_VERSAO,
} from "@/lib/portal-candidato.functions";
import { supabase } from "@/integrations/supabase/client";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE } from "@/lib/recrutamento/data";

// Vídeo-pitch do candidato (portal). O TITULAR grava (ou envia) um vídeo curto
// de apresentação, aceita o termo de consentimento e faz o upload client-side
// no bucket "videos" (path `${empresaId}/${candidatoId}/pitch-<uuid>.webm`).
// O registro é feito por salvarMeuVideo e a transcrição/análise dispara em
// segundo plano (processarMeuVideo) — o titular nunca vê a análise.

const MAX_S = 90; // duração máxima da gravação (contador regressivo)
const FALLBACK_MAX_MB = 50; // limite do arquivo no fallback sem câmera

const btnPri = (habilitado: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  background: habilitado ? ROXO : "#D8D2E6",
  color: "#fff",
  border: "none",
  padding: "12px 20px",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: habilitado ? "pointer" : "not-allowed",
  fontFamily: "inherit",
  minHeight: 46,
});
const btnSec: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  background: "#fff",
  color: ROXO,
  border: `1.5px solid ${BORDA}`,
  padding: "11px 18px",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  minHeight: 46,
};
const videoStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  borderRadius: 12,
  background: "#000",
  display: "block",
};

function ErroInline({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div
      style={{
        fontSize: 12.5,
        color: "#B91C1C",
        background: "#FEF2F2",
        border: "1px solid #FECACA",
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
      }}
    >
      {msg}
    </div>
  );
}

function fmtDataPt(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/** Duração (s) de um arquivo de vídeo via metadata — best-effort. */
function lerDuracao(f: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const v = document.createElement("video");
      v.preload = "metadata";
      const u = URL.createObjectURL(f);
      const fim = (d: number | null) => {
        URL.revokeObjectURL(u);
        resolve(d);
      };
      v.onloadedmetadata = () => fim(Number.isFinite(v.duration) ? v.duration : null);
      v.onerror = () => fim(null);
      v.src = u;
    } catch {
      resolve(null);
    }
  });
}

export function VideoPitchGravador({
  candidatoId,
  empresaId,
  video,
  onMudou,
}: {
  candidatoId: string;
  /** Empresa da candidatura — monta o path de upload no bucket "videos". */
  empresaId: string | null;
  video: {
    habilitado: boolean;
    tem_video: boolean;
    duracao_s: number | null;
    criado_em: string | null;
  };
  onMudou: () => void;
}) {
  const salvarVideo = useServerFn(salvarMeuVideo);
  const processarVideo = useServerFn(processarMeuVideo);
  const gerarUrl = useServerFn(urlMeuVideo);
  const removerVideo = useServerFn(removerMeuVideo);

  // Gravação
  const [mostrarGravador, setMostrarGravador] = useState(false);
  const [usarFallback, setUsarFallback] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [gravando, setGravando] = useState(false);
  const [restante, setRestante] = useState(MAX_S);
  const [gravadoBlob, setGravadoBlob] = useState<Blob | null>(null);
  const [gravadoUrl, setGravadoUrl] = useState("");
  const [duracaoGravada, setDuracaoGravada] = useState(0);
  const [arquivoFallback, setArquivoFallback] = useState<File | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restanteRef = useRef(MAX_S);
  const liveRef = useRef<HTMLVideoElement | null>(null);

  // Envio / vídeo existente
  const [aceitou, setAceitou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [msgOk, setMsgOk] = useState("");
  const [urlVideo, setUrlVideo] = useState("");
  const [buscandoUrl, setBuscandoUrl] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  function pararTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }
  function limparTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // Sempre parar câmera/timer/objectURL ao desmontar.
  useEffect(() => {
    return () => {
      limparTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recRef.current && recRef.current.state !== "inactive") {
        try {
          recRef.current.stop();
        } catch {
          /* já parado */
        }
      }
    };
  }, []);
  useEffect(() => {
    return () => {
      if (gravadoUrl) URL.revokeObjectURL(gravadoUrl);
    };
  }, [gravadoUrl]);

  // Preview ao vivo: srcObject não é atributo — injeta via ref.
  useEffect(() => {
    if (liveRef.current && stream) liveRef.current.srcObject = stream;
  }, [stream]);

  // empresaId é necessário para montar o path do upload — sem ele não há como
  // enviar o vídeo, então a seção inteira fica oculta (nada a fazer aqui).
  if (!video.habilitado || !empresaId) return null;

  function descartarGravacao() {
    if (gravadoUrl) URL.revokeObjectURL(gravadoUrl);
    setGravadoBlob(null);
    setGravadoUrl("");
    setDuracaoGravada(0);
    setArquivoFallback(null);
    setAceitou(false);
  }

  async function abrirGravador() {
    setErro("");
    setMsgOk("");
    setUrlVideo("");
    descartarGravacao();
    setMostrarGravador(true);
    // GUARD: sem getUserMedia/MediaRecorder (navegador antigo ou http) →
    // fallback de arquivo com a câmera nativa do celular.
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setUsarFallback(true);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 } },
        audio: true,
      });
      streamRef.current = s;
      setStream(s);
      setUsarFallback(false);
    } catch {
      // GUARD: permissão negada / sem câmera → fallback de arquivo.
      setUsarFallback(true);
    }
  }

  function fecharGravador() {
    limparTimer();
    pararTracks();
    descartarGravacao();
    setGravando(false);
    setRestante(MAX_S);
    setUsarFallback(false);
    setMostrarGravador(false);
  }

  function pararGravacao() {
    limparTimer();
    setDuracaoGravada(Math.min(MAX_S, Math.max(1, MAX_S - restanteRef.current)));
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setGravando(false);
  }

  function iniciarGravacao() {
    const s = streamRef.current;
    if (!s || gravando) return;
    setErro("");
    try {
      // mimeType 'video/webm' quando suportado; senão o default do navegador.
      const rec = MediaRecorder.isTypeSupported?.("video/webm")
        ? new MediaRecorder(s, { mimeType: "video/webm" })
        : new MediaRecorder(s);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" });
        setGravadoBlob(blob);
        setGravadoUrl(URL.createObjectURL(blob));
        pararTracks(); // libera a câmera assim que a gravação termina
      };
      recRef.current = rec;
      rec.start();
      restanteRef.current = MAX_S;
      setRestante(MAX_S);
      setGravando(true);
      timerRef.current = setInterval(() => {
        restanteRef.current -= 1;
        setRestante(restanteRef.current);
        if (restanteRef.current <= 0) pararGravacao(); // auto-para no 0
      }, 1000);
    } catch {
      pararTracks();
      setUsarFallback(true);
    }
  }

  function onArquivoFallback(f: File | null) {
    setErro("");
    if (!f) {
      setArquivoFallback(null);
      return;
    }
    if (f.size > FALLBACK_MAX_MB * 1024 * 1024) {
      setErro(
        `Arquivo muito grande. O limite é ${FALLBACK_MAX_MB} MB — grave um vídeo mais curto.`,
      );
      return;
    }
    setArquivoFallback(f);
  }

  async function onEnviar() {
    const conteudo = gravadoBlob ?? arquivoFallback;
    if (!conteudo || enviando || !empresaId) return;
    if (!aceitou) {
      setErro("Para enviar, você precisa ler e aceitar o termo do vídeo.");
      return;
    }
    setEnviando(true);
    setErro("");
    setMsgOk("");
    try {
      let duracaoS = duracaoGravada;
      if (!gravadoBlob && arquivoFallback) {
        const d = await lerDuracao(arquivoFallback);
        if (d != null && d > 120) {
          throw new Error("Seu vídeo passou de 90 segundos. Grave uma versão mais curta.");
        }
        duracaoS = d != null ? Math.round(d) : MAX_S;
      }
      duracaoS = Math.min(120, Math.max(1, Math.round(duracaoS || 1)));

      const storagePath = `${empresaId}/${candidatoId}/pitch-${crypto.randomUUID()}.webm`;
      const { error: upErr } = await supabase.storage
        .from("videos")
        .upload(storagePath, conteudo, { contentType: conteudo.type || "video/webm" });
      if (upErr) throw new Error("Não foi possível enviar o vídeo. Tente de novo.");

      await salvarVideo({
        data: {
          candidatoId,
          storagePath,
          duracaoS,
          aceitouTermo: true,
          versaoTermo: TERMO_VIDEO_VERSAO,
        },
      });
      // Transcrição/análise em segundo plano — não bloqueia o titular.
      processarVideo({ data: { candidatoId } }).catch((e) =>
        console.warn("Processamento do vídeo falhou:", e),
      );
      fecharGravador();
      setMsgOk("Vídeo enviado! A empresa poderá assistir.");
      onMudou();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível enviar o vídeo.");
    } finally {
      setEnviando(false);
    }
  }

  async function onVerVideo() {
    if (buscandoUrl) return;
    setBuscandoUrl(true);
    setErro("");
    try {
      // A URL assinada vence em 90s — buscar sempre na hora do clique.
      const r: any = await gerarUrl({ data: { candidatoId } });
      if (!r?.url) throw new Error("Não foi possível gerar o link do vídeo.");
      setUrlVideo(r.url);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível abrir o vídeo.");
    } finally {
      setBuscandoUrl(false);
    }
  }

  async function onRemover() {
    if (removendo) return;
    if (!window.confirm("Remover seu vídeo? A empresa não poderá mais assisti-lo.")) return;
    setRemovendo(true);
    setErro("");
    setMsgOk("");
    try {
      await removerVideo({ data: { candidatoId } });
      setUrlVideo("");
      onMudou();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível remover o vídeo.");
    } finally {
      setRemovendo(false);
    }
  }

  const prontoParaEnvio = !!(gravadoBlob || arquivoFallback);

  const termoBloco = (
    <div style={{ marginTop: 12 }}>
      <details
        style={{
          border: `1px solid ${BORDA}`,
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 10,
          background: "#FBFAFE",
        }}
      >
        <summary style={{ fontSize: 12.5, fontWeight: 700, color: ROXO, cursor: "pointer" }}>
          Ler o termo do vídeo
        </summary>
        <p
          style={{
            fontSize: 12,
            color: CINZA,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            margin: "8px 0 0",
          }}
        >
          {TERMO_VIDEO}
        </p>
      </details>
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          fontSize: 13,
          color: ROXO_DARK,
          cursor: "pointer",
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        <input
          type="checkbox"
          checked={aceitou}
          onChange={(e) => setAceitou(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        Li e aceito o termo do vídeo: autorizo o uso da minha imagem e voz para este processo
        seletivo.
      </label>
      <button
        onClick={onEnviar}
        disabled={!aceitou || enviando}
        style={btnPri(aceitou && !enviando)}
      >
        {enviando ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Enviar vídeo
      </button>
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: 13, color: CINZA, lineHeight: 1.55, margin: "0 0 12px" }}>
        Grave um vídeo curto se apresentando. Fale seu nome, sua experiência e por que você quer
        essa vaga. Pode gravar quantas vezes quiser antes de enviar.
      </p>
      <ErroInline msg={erro} />
      {msgOk && (
        <div
          style={{
            fontSize: 12.5,
            color: VERDE,
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: 10,
            padding: 10,
            marginBottom: 12,
          }}
        >
          {msgOk}
        </div>
      )}

      {/* ===== Vídeo já enviado ===== */}
      {video.tem_video && !mostrarGravador && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              fontSize: 13,
              fontWeight: 600,
              color: ROXO_DARK,
              background: ROXO_TINT,
              border: `1px solid ${BORDA}`,
              borderRadius: 10,
              padding: "9px 12px",
              marginBottom: 12,
            }}
          >
            <Check size={15} color={VERDE} style={{ flexShrink: 0 }} />
            Vídeo enviado{video.criado_em ? ` em ${fmtDataPt(video.criado_em)}` : ""}
            {video.duracao_s ? (
              <span style={{ fontSize: 12, color: CINZA, fontWeight: 500 }}>
                · {video.duracao_s}s
              </span>
            ) : null}
          </div>
          {urlVideo && (
            <video
              controls
              autoPlay
              playsInline
              src={urlVideo}
              style={{ ...videoStyle, marginBottom: 12 }}
            />
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {!urlVideo && (
              <button onClick={onVerVideo} disabled={buscandoUrl} style={btnSec}>
                {buscandoUrl ? <Loader2 size={15} className="spin" /> : <Eye size={15} />} Ver meu
                vídeo
              </button>
            )}
            <button onClick={abrirGravador} style={btnSec}>
              <RotateCcw size={15} /> Regravar
            </button>
            <button
              onClick={onRemover}
              disabled={removendo}
              style={{ ...btnSec, color: "#B91C1C", borderColor: "#FECACA" }}
            >
              {removendo ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} Remover
            </button>
          </div>
        </div>
      )}

      {/* ===== Sem vídeo ainda ===== */}
      {!video.tem_video && !mostrarGravador && (
        <button onClick={abrirGravador} style={btnPri(true)}>
          <Camera size={15} /> Gravar meu vídeo (até {MAX_S}s)
        </button>
      )}

      {/* ===== Gravador ===== */}
      {mostrarGravador && (
        <div
          style={{
            border: `1.5px solid ${BORDA}`,
            borderRadius: 12,
            padding: 14,
            background: "#FBFAFE",
          }}
        >
          {usarFallback ? (
            // Fallback: sem câmera pelo navegador — envia um arquivo de vídeo.
            <div>
              <p style={{ fontSize: 12.5, color: CINZA, lineHeight: 1.55, margin: "0 0 10px" }}>
                Não conseguimos acessar sua câmera por aqui. Grave o vídeo com a câmera do seu
                celular e envie o arquivo (até {FALLBACK_MAX_MB} MB).
              </p>
              <input
                type="file"
                accept="video/*"
                capture="user"
                onChange={(e) => onArquivoFallback(e.target.files?.[0] ?? null)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: `1.5px solid ${BORDA}`,
                  borderRadius: 10,
                  fontSize: 13.5,
                  background: "#fff",
                  color: ROXO_DARK,
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              />
              {arquivoFallback && (
                <div style={{ fontSize: 12.5, color: ROXO_DARK, fontWeight: 600, marginTop: 8 }}>
                  <Video size={13} color={ROXO} style={{ verticalAlign: "-2px" }} />{" "}
                  {arquivoFallback.name}
                </div>
              )}
              {arquivoFallback && termoBloco}
            </div>
          ) : gravadoBlob ? (
            // Revisão do que foi gravado
            <div>
              <video
                controls
                playsInline
                src={gravadoUrl}
                style={{ ...videoStyle, marginBottom: 10 }}
              />
              <div style={{ fontSize: 12.5, color: CINZA, marginBottom: 10 }}>
                Gravação de {duracaoGravada}s. Gostou? Se quiser, grave de novo.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button onClick={abrirGravador} style={btnSec}>
                  <RotateCcw size={15} /> Regravar
                </button>
              </div>
              {termoBloco}
            </div>
          ) : (
            // Preview ao vivo + gravação
            <div>
              {stream ? (
                <video
                  ref={liveRef}
                  muted
                  autoPlay
                  playsInline
                  style={{ ...videoStyle, marginBottom: 10 }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: CINZA,
                    marginBottom: 10,
                  }}
                >
                  <Loader2 size={15} className="spin" /> Abrindo sua câmera...
                </div>
              )}
              {gravando && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 14,
                    fontWeight: 800,
                    color: restante <= 10 ? "#B91C1C" : LARANJA,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 99,
                      background: "#DC2626",
                      display: "inline-block",
                    }}
                  />
                  Gravando — {restante}s restantes
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {!gravando ? (
                  <button onClick={iniciarGravacao} disabled={!stream} style={btnPri(!!stream)}>
                    <Play size={15} /> Iniciar
                  </button>
                ) : (
                  <button
                    onClick={pararGravacao}
                    style={{ ...btnPri(true), background: "#DC2626" }}
                  >
                    <Square size={15} /> Parar
                  </button>
                )}
                {!gravando && (
                  <button onClick={fecharGravador} style={btnSec}>
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          )}
          {(usarFallback || gravadoBlob) && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={fecharGravador}
                style={{ ...btnSec, padding: "8px 14px", fontSize: 12.5, minHeight: 0 }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
