import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Wand2, Loader2, Plus, X, CheckCircle2, AlertCircle, Save, Send, Brain, MessageCircle, Link2, Copy, Check, ExternalLink } from "lucide-react";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { supabase } from "@/integrations/supabase/client";
import { gerarFormularioVaga } from "@/lib/recrutamento.functions";
import {
  ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE, VERMELHO, AMARELO,
  DIM_INFO, validateDiscBlocks, getDiscBlocks, type Vaga, type DiscBlock, type Situacao, type Dim,
} from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_authenticated/previa/$id")({
  head: () => ({ meta: [{ title: "Prévia do formulário · Estrela" }] }),
  component: PreviaPage,
});

const inp: React.CSSProperties = { width: "100%", padding: "9px 11px", border: `1.5px solid ${BORDA}`, borderRadius: 9, fontSize: 13.5, outline: "none", background: "#fff", color: ROXO_DARK, fontFamily: "inherit" };
const PTS_ROT: Record<number, [string, string]> = { 100: ["Melhor", VERDE], 70: ["Boa", LARANJA], 40: ["Fraca", AMARELO], 15: ["Ruim", VERMELHO] };

function PreviaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const gerar = useServerFn(gerarFormularioVaga);

  const vagaQ = useQuery({
    queryKey: ["vaga-previa", id],
    queryFn: async (): Promise<Vaga | null> => {
      const { data, error } = await supabase.from("vagas").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [blocks, setBlocks] = useState<DiscBlock[]>([]);
  const [sits, setSits] = useState<Situacao[]>([]);
  const [aprovado, setAprovado] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [gerandoDisc, setGerandoDisc] = useState(false);
  const [gerandoSit, setGerandoSit] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err" | "warn"; t: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!vagaQ.data) return;
    setBlocks(getDiscBlocks(vagaQ.data));
    setSits(Array.isArray(vagaQ.data.situacoes) ? (vagaQ.data.situacoes as any) : []);
    setAprovado(!!vagaQ.data.formulario_aprovado);
    setDirty(false);
  }, [vagaQ.data]);

  if (vagaQ.isLoading) return <div style={{ padding: 40, textAlign: "center", color: CINZA }}>Carregando...</div>;
  const vaga = vagaQ.data;
  if (!vaga) return <div style={{ padding: 40, textAlign: "center", color: CINZA }}>Vaga não encontrada.</div>;

  const mark = () => { setDirty(true); setAprovado(false); };

  function ctxPayload() {
    const v = vaga!;
    return {
      titulo: v.titulo, setor: v.setor, descricao: v.descricao,
      modelo: (v as any).modelo, tipo: (v as any).tipo,
      experiencia: (v as any).experiencia, escolaridade: (v as any).escolaridade,
      requisitos: (v as any).requisitos,
      habilidades: (v as any).habilidades ?? [],
      competencias: (v as any).competencias ?? [],
      pesos: (v as any).pesos ?? {},
      usar_situacional: v.usar_situacional,
    };
  }

  async function gerarDisc() {
    setGerandoDisc(true); setMsg(null);
    try {
      const r: any = await gerar({ data: { ...ctxPayload(), modo: "disc" } });
      if (Array.isArray(r?.disc_blocks)) {
        setBlocks(r.disc_blocks);
        mark();
        if (r.disc_fallback) setMsg({ tipo: "warn", t: "IA não devolveu DISC válido; usamos o conjunto base." });
        else setMsg({ tipo: "ok", t: "DISC adaptado ao contexto." });
      }
    } catch (e: any) { setMsg({ tipo: "err", t: e.message || "Falha ao gerar DISC." }); }
    finally { setGerandoDisc(false); }
  }
  async function gerarSit() {
    setGerandoSit(true); setMsg(null);
    try {
      const r: any = await gerar({ data: { ...ctxPayload(), modo: "situacoes" } });
      if (Array.isArray(r?.situacoes)) { setSits(r.situacoes); mark(); setMsg({ tipo: "ok", t: "Situações geradas." }); }
    } catch (e: any) { setMsg({ tipo: "err", t: e.message || "Falha ao gerar situações." }); }
    finally { setGerandoSit(false); }
  }

  const editBlocoTxt = (bi: number, oi: number, txt: string) => {
    setBlocks((p) => { const n = p.map((b) => ({ ...b, opcoes: b.opcoes.map((o) => ({ ...o })) })); n[bi].opcoes[oi].txt = txt; return n; });
    mark();
  };
  const editSitTit = (i: number, txt: string) => { setSits((p) => p.map((s, j) => j === i ? { ...s, titulo: txt } : s)); mark(); };
  const editSitOpt = (i: number, oi: number, field: "txt" | "pts", v: string | number) => {
    setSits((p) => p.map((s, j) => j === i ? { ...s, options: s.options.map((o, k) => k === oi ? { ...o, [field]: v } : o) } : s)); mark();
  };
  const addSit = () => { setSits((p) => [...p, { titulo: "Nova situação", options: [{ txt: "", pts: 100 }, { txt: "", pts: 70 }, { txt: "", pts: 40 }, { txt: "", pts: 15 }] }]); mark(); };
  const rmSit = (i: number) => { setSits((p) => p.filter((_, j) => j !== i)); mark(); };

  async function salvar(publicar: boolean) {
    setMsg(null);
    if (publicar && !validateDiscBlocks(blocks)) {
      setMsg({ tipo: "err", t: "DISC inválido: cada bloco precisa de 4 opções com uma de cada dimensão D/I/S/C." });
      return;
    }
    setSalvando(true);
    try {
      const payload: any = { disc_blocks: blocks, situacoes: sits, formulario_aprovado: publicar ? true : false };
      if (publicar) payload.status = "Aberta";
      const { data: updated, error } = await supabase.from("vagas").update(payload).eq("id", vaga!.id).select("link_token").maybeSingle();
      if (error) throw error;
      setAprovado(publicar); setDirty(false);
      if (publicar) {
        const token = (updated as any)?.link_token || (vaga as any)?.link_token;
        if (token) {
          setPublishedUrl(`${window.location.origin}/c/${token}`);
          setCopiado(false);
        }
      } else {
        setMsg({ tipo: "ok", t: "Rascunho salvo." });
      }
    } catch (e: any) { setMsg({ tipo: "err", t: e.message || "Falha ao salvar." }); }
    finally { setSalvando(false); }
  }

  async function copiarLink() {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = publishedUrl; document.body.appendChild(el); el.select();
      try { document.execCommand("copy"); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch {}
      document.body.removeChild(el);
    }
  }

  const discValido = validateDiscBlocks(blocks);
  const estadoCor = aprovado && !dirty ? VERDE : AMARELO;
  const estadoTxt = aprovado && !dirty ? "Aprovado" : "Rascunho";

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK, paddingBottom: 60 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} .h{font-family:'Outfit',sans-serif}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${ROXO}!important;box-shadow:0 0 0 3px ${ROXO_TINT}}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}
        @media (max-width:640px){ input,select,textarea{font-size:16px!important} }
      `}</style>
      <div style={{ background: ROXO, padding: "13px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 30 }}>
        <MarcaEstrela size={32} branca />
        <div style={{ lineHeight: 1, minWidth: 0, flex: 1 }}>
          <div className="h" style={{ color: "#fff", fontWeight: 700, letterSpacing: 2, fontSize: 10.5, opacity: 0.85 }}>PRÉVIA DO FORMULÁRIO</div>
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vaga.titulo}</div>
        </div>
        <span style={{ background: estadoCor, color: "#fff", padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>{estadoTxt}</span>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "18px" }}>
        <button onClick={() => navigate({ to: "/admin" })} style={{ background: "none", border: "none", color: CINZA, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 13.5, marginBottom: 14 }}>
          <ChevronLeft size={16} /> Voltar ao painel
        </button>

        <div style={{ background: ROXO_TINT, border: `1px solid ${ROXO}33`, borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 12.5, color: ROXO_DARK, lineHeight: 1.5 }}>
          <strong>Aviso:</strong> O DISC tem <strong>estrutura fixa</strong> (4 opções por bloco, uma de cada dimensão D/I/S/C). Você pode editar os textos e regenerar com IA, mas a estrutura é travada — isso garante a validade do cálculo do perfil, que <strong>não muda</strong>.
        </div>

        {msg && (
          <div style={{
            background: msg.tipo === "ok" ? "#ECFDF5" : msg.tipo === "warn" ? "#FFFBEB" : "#FEF2F2",
            border: `1px solid ${msg.tipo === "ok" ? "#A7F3D0" : msg.tipo === "warn" ? "#FDE68A" : "#FECACA"}`,
            color: msg.tipo === "ok" ? "#047857" : msg.tipo === "warn" ? "#92400E" : "#B91C1C",
            borderRadius: 11, padding: 11, marginBottom: 14, fontSize: 13, display: "flex", gap: 8, alignItems: "center",
          }}>
            {msg.tipo === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {msg.t}
          </div>
        )}

        {/* DISC */}
        <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <Brain size={18} color={ROXO} />
            <div className="h" style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Perguntas de perfil (DISC)</div>
            <button onClick={gerarDisc} disabled={gerandoDisc} style={btnIA(gerandoDisc)}>
              {gerandoDisc ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />} Adaptar ao contexto
            </button>
          </div>
          {!discValido && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 9, padding: 9, fontSize: 12.5, marginBottom: 10 }}>DISC inválido: cada bloco precisa de 4 opções, uma de cada D/I/S/C.</div>}
          {blocks.map((b, bi) => (
            <div key={bi} style={{ background: ROXO_TINT, borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: ROXO, marginBottom: 8 }}>BLOCO {bi + 1}</div>
              {b.opcoes.map((o, oi) => (
                <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ width: 36, textAlign: "center", padding: "5px 0", borderRadius: 7, background: DIM_INFO[o.dim as Dim].cor, color: "#fff", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{o.dim}</span>
                  <input style={inp} value={o.txt} onChange={(e) => editBlocoTxt(bi, oi, e.target.value)} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* SITUAÇÕES */}
        <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <MessageCircle size={18} color={ROXO} />
            <div className="h" style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Situações reais</div>
            {vaga.usar_situacional && (
              <button onClick={gerarSit} disabled={gerandoSit} style={btnIA(gerandoSit)}>
                {gerandoSit ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />} Gerar com IA
              </button>
            )}
          </div>
          {!vaga.usar_situacional && <div style={{ fontSize: 12.5, color: CINZA, background: ROXO_TINT, padding: 11, borderRadius: 9, marginBottom: 10 }}>Esta vaga está com situações <strong>desligadas</strong>. O match usará 100% o perfil DISC.</div>}
          {sits.map((s, i) => (
            <div key={i} style={{ border: `1px solid ${BORDA}`, borderRadius: 11, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input style={{ ...inp, fontWeight: 700 }} value={s.titulo} onChange={(e) => editSitTit(i, e.target.value)} placeholder="Título da situação" />
                <button onClick={() => rmSit(i)} style={{ background: "none", border: `1.5px solid ${BORDA}`, color: VERMELHO, borderRadius: 9, padding: "0 10px", cursor: "pointer" }}><X size={15} /></button>
              </div>
              {s.options.map((o, oi) => {
                const [rot, cor] = PTS_ROT[o.pts] ?? ["?", CINZA];
                return (
                  <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <select value={o.pts} onChange={(e) => editSitOpt(i, oi, "pts", Number(e.target.value))} style={{ ...inp, width: 110, color: cor, fontWeight: 700, flexShrink: 0 }}>
                      <option value={100}>Melhor (100)</option><option value={70}>Boa (70)</option><option value={40}>Fraca (40)</option><option value={15}>Ruim (15)</option>
                    </select>
                    <input style={inp} value={o.txt} onChange={(e) => editSitOpt(i, oi, "txt", e.target.value)} placeholder={`Opção ${rot}`} />
                  </div>
                );
              })}
            </div>
          ))}
          {vaga.usar_situacional && (
            <button onClick={addSit} style={{ background: "#fff", color: ROXO, border: `1.5px dashed ${ROXO}66`, padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
              <Plus size={15} /> Adicionar situação
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={() => salvar(false)} disabled={salvando} style={{ background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`, padding: "12px 18px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit", minHeight: 48 }}>
            <Save size={16} /> Salvar rascunho
          </button>
          <button onClick={() => salvar(true)} disabled={salvando || !discValido} style={{ background: !discValido ? "#D8D2E6" : LARANJA, color: "#fff", border: "none", padding: "12px 20px", borderRadius: 11, fontSize: 14.5, fontWeight: 700, cursor: discValido && !salvando ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit", minHeight: 48 }}>
            <Send size={16} /> Aprovar e publicar
          </button>
        </div>
      </div>

      {publishedUrl && (
        <div
          onClick={() => setPublishedUrl(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,10,40,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, maxWidth: 520, width: "100%", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", position: "relative" }}
          >
            <button onClick={() => setPublishedUrl(null)} aria-label="Fechar" style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: CINZA, padding: 6, borderRadius: 8 }}>
              <X size={18} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={20} color={VERDE} />
              </div>
              <div className="h" style={{ fontWeight: 800, fontSize: 18, color: ROXO_DARK }}>Vaga publicada!</div>
            </div>
            <p style={{ fontSize: 13.5, color: CINZA, lineHeight: 1.55, margin: "6px 0 14px" }}>
              Compartilhe o link abaixo com os candidatos por WhatsApp, e-mail ou qualquer mensageiro.
            </p>

            <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 12 }}>
              <input
                readOnly
                value={publishedUrl}
                onFocus={(e) => e.currentTarget.select()}
                style={{ ...inp, fontSize: 13, color: ROXO_DARK, background: "#FAF9FE" }}
              />
              <button
                onClick={copiarLink}
                style={{ background: copiado ? VERDE : ROXO, color: "#fff", border: "none", padding: "0 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", flexShrink: 0 }}
              >
                {copiado ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Vaga: ${vaga.titulo}\n${publishedUrl}`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ background: "#25D366", color: "#fff", textDecoration: "none", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
              <a
                href={publishedUrl} target="_blank" rel="noopener noreferrer"
                style={{ background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`, textDecoration: "none", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
              >
                <ExternalLink size={15} /> Abrir link
              </a>
              <button
                onClick={() => { setPublishedUrl(null); navigate({ to: "/admin" }); }}
                style={{ background: "#fff", color: CINZA, border: `1.5px solid ${BORDA}`, padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", marginLeft: "auto" }}
              >
                Ir para o painel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnIA = (loading: boolean): React.CSSProperties => ({
  background: loading ? "#D8D2E6" : ROXO, color: "#fff", border: "none", padding: "8px 12px",
  borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: loading ? "default" : "pointer",
  display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
});
