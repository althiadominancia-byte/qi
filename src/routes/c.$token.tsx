import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Phone, Mail, MapPin, User, FileText, Upload, Brain, Users,
  ChevronRight, ChevronLeft, CheckCircle2, Target, ShieldCheck,
  BarChart3, Star, Headphones, MessageCircle,
  Loader2, Briefcase, AlertCircle, Lightbulb, ThumbsUp, Ban,
} from "lucide-react";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { supabase } from "@/integrations/supabase/client";
import { analisarCv } from "@/lib/recrutamento.functions";
import {
  ROXO, ROXO_DARK, ROXO_TINT, ROXO_TINT2, LARANJA, LARANJA_TINT, CINZA, BORDA, VERDE,
  DIM_INFO, getDiscBlocks, getSituacoes,
  COR_RACA, GENERO, ORIENTACAO, PCD, POLITICO,
  computeResults, corNivel, efetivamenteEncerrada,
  type Vaga,
} from "@/lib/recrutamento/data";

export const Route = createFileRoute("/c/$token")({
  head: () => ({ meta: [{ title: "Inscrição — Distribuidora Estrela" }] }),
  component: FormPublico,
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 13px", border: `1.5px solid ${BORDA}`, borderRadius: 11,
  fontSize: 14, outline: "none", background: "#fff", color: ROXO_DARK, boxSizing: "border-box", fontFamily: "inherit",
};
const tagBtn = (on: boolean, cor: string): React.CSSProperties => ({
  flexShrink: 0, padding: "6px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
  border: `1.5px solid ${on ? cor : BORDA}`, background: on ? cor : "#fff", color: on ? "#fff" : CINZA, fontFamily: "inherit",
});

function Card({ children }: any) { return <div data-card style={{ background: "#fff", borderRadius: 18, padding: 24, border: `1px solid ${BORDA}`, boxShadow: "0 8px 30px -12px rgba(80,50,138,.18)", marginBottom: 14 }}>{children}</div>; }
function Badge({ children }: any) { return <span style={{ fontSize: 11.5, fontWeight: 700, background: LARANJA_TINT, color: LARANJA, padding: "5px 11px", borderRadius: 99, letterSpacing: 0.5 }}>{children}</span>; }
function Titulo({ icon: Icon, children, sub }: any) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: ROXO_TINT, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={19} color={ROXO} /></div>
        <h2 className="h" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{children}</h2>
      </div>
      {sub && <p style={{ fontSize: 13, color: CINZA, margin: "8px 0 0", lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}
function Campo({ icon: Icon, label, children, obrig }: any) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: ROXO_DARK, marginBottom: 7 }}>
        {Icon && <Icon size={15} color={ROXO} />} {label} {obrig && <span style={{ color: LARANJA }}>*</span>}
      </span>
      {children}
    </label>
  );
}
function Pill({ ativo, onClick, children }: any) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "10px 14px", borderRadius: 11, fontSize: 13.5, cursor: "pointer", textAlign: "left",
      border: `1.5px solid ${ativo ? ROXO : BORDA}`, background: ativo ? ROXO_TINT : "#fff",
      color: ativo ? ROXO_DARK : CINZA, fontWeight: ativo ? 600 : 500, fontFamily: "inherit", lineHeight: 1.35,
    }}>{children}</button>
  );
}
function DivCampo({ label, opts, val, on }: any) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: ROXO_DARK, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {opts.map((o: string) => (
          <button type="button" key={o} onClick={() => on(o)} style={{
            padding: "8px 13px", borderRadius: 99, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
            border: `1.5px solid ${val === o ? ROXO : BORDA}`, background: val === o ? ROXO_TINT : "#fff",
            color: val === o ? ROXO_DARK : CINZA, fontWeight: val === o ? 700 : 500,
            opacity: o === "Prefiro não responder" && val !== o ? 0.75 : 1,
          }}>{o}</button>
        ))}
      </div>
    </div>
  );
}
function Linha({ k, v }: any) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORDA}`, fontSize: 13.5 }}>
    <span style={{ color: CINZA }}>{k}</span><span style={{ fontWeight: 600, color: ROXO_DARK, textAlign: "right", maxWidth: "60%" }}>{v}</span>
  </div>;
}
function Nav({ back, next, pode, textoNext = "Continuar", aviso }: any) {
  return (
    <div>
      {aviso && <div style={{ fontSize: 12, color: LARANJA, marginBottom: 10, fontWeight: 600 }}>{aviso}</div>}
      <div data-nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 10 }}>
        <button type="button" onClick={back} style={{ background: "none", border: "none", color: CINZA, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", fontSize: 14, minHeight: 44, padding: "0 8px" }}><ChevronLeft size={17} /> Voltar</button>
        <button type="button" onClick={next} disabled={!pode} style={{ background: pode ? ROXO : "#D8D2E6", color: "#fff", border: "none", padding: "12px 22px", borderRadius: 12, fontSize: 14.5, fontWeight: 700, cursor: pode ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", minHeight: 48 }}>{textoNext} <ChevronRight size={17} /></button>
      </div>
    </div>
  );
}
function MatchRing({ match, label }: any) {
  const r = 34, c = 2 * Math.PI * r;
  const cor = match >= 85 ? VERDE : match >= 70 ? LARANJA : match >= 55 ? "#CA8A04" : "#DC2626";
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} fill="none" stroke="#EEEAF6" strokeWidth="9" />
        <circle cx="46" cy="46" r={r} fill="none" stroke={cor} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * match) / 100} transform="rotate(-90 46 46)" />
        <text x="46" y="42" textAnchor="middle" fontSize="22" fontWeight="800" fill={cor} fontFamily="Outfit">{match}%</text>
        <text x="46" y="58" textAnchor="middle" fontSize="9" fill="#888" fontFamily="Plus Jakarta Sans">match</text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 700, color: cor, marginTop: -4 }}>{label}</div>
    </div>
  );
}
function Box({ titulo, icon: Icon, cor, items }: any) {
  return (
    <div style={{ background: ROXO_TINT, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12.5, color: cor, marginBottom: 9 }}><Icon size={14} /> {titulo}</div>
      {(items || []).map((t: string, i: number) => <div key={i} style={{ fontSize: 12.5, color: CINZA, marginBottom: 6, display: "flex", gap: 6 }}><span style={{ color: cor }}>•</span> {t}</div>)}
    </div>
  );
}
function Mini({ label, v, sub }: any) {
  return (
    <div style={{ flex: 1, border: `1px solid ${BORDA}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11.5, color: CINZA, fontWeight: 600 }}>{label}</div>
      <div className="h" style={{ fontSize: 22, fontWeight: 800, color: ROXO, lineHeight: 1.1, margin: "2px 0" }}>{v}</div>
      <div style={{ fontSize: 10.5, color: "#9b93b0" }}>{sub}</div>
    </div>
  );
}
function NivelBadge({ nivel }: any) {
  const cor = corNivel(nivel);
  const txt = nivel === "alta" ? "Alta" : nivel === "media" ? "Média" : "Baixa";
  return <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: cor, padding: "2px 9px", borderRadius: 99 }}>{txt}</span>;
}

function HeaderRoxo({ titulo = "Processo Seletivo" }: { titulo?: string }) {
  return (
    <div style={{ background: ROXO, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 30 }}>
      <MarcaEstrela size={34} branca />
      <div style={{ lineHeight: 1 }}>
        <div className="h" style={{ color: "#fff", fontWeight: 700, letterSpacing: 2, fontSize: 11, opacity: 0.85 }}>DISTRIBUIDORA</div>
        <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 19, letterSpacing: 1 }}>ESTRELA</div>
      </div>
      <div data-header-sub style={{ marginLeft: "auto", color: "#fff", fontSize: 12, opacity: 0.8, display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
        <Headphones size={15} /> {titulo}
      </div>
    </div>
  );
}

function FormPublico() {
  const { token } = Route.useParams();
  const vagaQ = useQuery({
    queryKey: ["vaga-publica", token],
    queryFn: async (): Promise<Vaga | null> => {
      const { data, error } = await supabase.from("vagas").select("*").eq("link_token", token).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  if (vagaQ.isLoading) {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK }}>
        <HeaderRoxo />
        <div style={{ maxWidth: 720, margin: "40px auto", textAlign: "center", color: CINZA }}>Carregando vaga...</div>
      </div>
    );
  }

  const vaga = vagaQ.data;
  if (!vaga) {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK }}>
        <HeaderRoxo />
        <div style={{ maxWidth: 560, margin: "60px auto", padding: "0 18px" }}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <AlertCircle size={36} color={LARANJA} />
              <h2 className="h" style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>Vaga não encontrada</h2>
              <p style={{ color: CINZA, fontSize: 14 }}>O link pode ter expirado ou estar incorreto.</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const encerrada = efetivamenteEncerrada(vaga) || vaga.status !== "Aberta";
  if (encerrada) {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK }}>
        <HeaderRoxo titulo={vaga.titulo} />
        <div style={{ maxWidth: 560, margin: "60px auto", padding: "0 18px" }}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <Ban size={36} color={LARANJA} />
              <h2 className="h" style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>Inscrições encerradas</h2>
              <p style={{ color: CINZA, fontSize: 14, lineHeight: 1.55 }}>
                As inscrições para a vaga <strong>{vaga.titulo}</strong> não estão mais abertas. Agradecemos o interesse!
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return <FormularioVaga vaga={vaga} />;
}

const FLOW_BASE = ["intro", "dados", "curriculo", "situacional", "disc", "diversidade", "revisao", "resultado"];
const FORM_BASE = ["dados", "curriculo", "situacional", "disc", "diversidade", "revisao"];
const STEP_META: Record<string, { n: string; icon: any }> = {
  dados: { n: "Seus dados", icon: User },
  curriculo: { n: "Currículo", icon: FileText },
  situacional: { n: "Situações", icon: MessageCircle },
  disc: { n: "Perfil DISC", icon: Brain },
  diversidade: { n: "Diversidade", icon: Users },
  revisao: { n: "Revisão", icon: CheckCircle2 },
};

function FormularioVaga({ vaga }: { vaga: Vaga }) {
  const FLOW = useMemo(() => vaga.usar_situacional ? FLOW_BASE : FLOW_BASE.filter((s) => s !== "situacional"), [vaga.usar_situacional]);
  const FORM_STEPS = useMemo(() => vaga.usar_situacional ? FORM_BASE : FORM_BASE.filter((s) => s !== "situacional"), [vaga.usar_situacional]);

  const [step, setStep] = useState("intro");
  const [a, setA] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setA((p) => ({ ...p, [k]: v }));

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvAnalysis, setCvAnalysis] = useState<any>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const idx = FLOW.indexOf(step);
  const formIdx = FORM_STEPS.indexOf(step);

  const setMais = (bi: number, oi: number) => setA((p) => {
    const n = { ...p }; n["disc_" + bi + "_mais"] = oi;
    if (n["disc_" + bi + "_menos"] === oi) delete n["disc_" + bi + "_menos"];
    return n;
  });
  const setMenos = (bi: number, oi: number) => setA((p) => {
    const n = { ...p }; n["disc_" + bi + "_menos"] = oi;
    if (n["disc_" + bi + "_mais"] === oi) delete n["disc_" + bi + "_mais"];
    return n;
  });

  const discDone = DISC_BLOCKS.filter((_, bi) => a["disc_" + bi + "_mais"] !== undefined && a["disc_" + bi + "_menos"] !== undefined).length;

  const podeAvancar = useMemo(() => {
    if (step === "dados") return a.nome && a.email && a.celular;
    if (step === "situacional") return SITUACIONAIS.every((q) => a["sit_" + q.id]);
    if (step === "disc") return discDone === DISC_BLOCKS.length;
    return true;
  }, [step, a, discDone]);

  const next = () => {
    if (step === "revisao") { void enviarInscricao(); return; }
    setStep(FLOW[idx + 1]); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => { setStep(FLOW[idx - 1]); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const resultado = useMemo(() => (step === "resultado" ? computeResults(a, vaga) : null), [step, a, vaga]);

  const textoExtra = (only?: boolean) => {
    const exp = a.exp ? "\nExperiência relatada: " + a.exp : "";
    const mot = a.motivo ? "\nMotivação: " + a.motivo : "";
    const j = exp + mot;
    return only ? (j || "Nenhuma informação adicional foi fornecida.") : j;
  };

  const vagaContexto = `Vaga: ${vaga.titulo} (${vaga.setor}, ${vaga.modelo}/${vaga.tipo}).\nDescrição: ${vaga.descricao}\nRequisitos: ${vaga.requisitos}\nExperiência desejada: ${vaga.experiencia}`;

  async function enviarInscricao() {
    setSubmitting(true); setSubmitError("");
    try {
      const r = computeResults(a, vaga);

      let cvPath: string | null = null;
      let cvMime: string | null = null;
      if (cvFile) {
        const ext = cvFile.name.split(".").pop() ?? "bin";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("curriculos").upload(path, cvFile, { contentType: cvFile.type || undefined });
        if (upErr) throw upErr;
        cvPath = path;
        cvMime = cvFile.type || null;
      }

      if (a.raca || a.genero || a.orientacao || a.pcd || a.politico) {
        await supabase.from("diversidade_candidatos").insert({
          raca: a.raca ?? null, genero: a.genero ?? null,
          orientacao: a.orientacao ?? null, pcd: a.pcd ?? null, politico: a.politico ?? null,
        });
      }

      const discResp: Record<string, any> = {};
      DISC_BLOCKS.forEach((_, bi) => {
        if (a["disc_" + bi + "_mais"] !== undefined) discResp["b" + bi + "_mais"] = a["disc_" + bi + "_mais"];
        if (a["disc_" + bi + "_menos"] !== undefined) discResp["b" + bi + "_menos"] = a["disc_" + bi + "_menos"];
      });
      const sitResp: Record<string, string> = {};
      SITUACIONAIS.forEach((q) => { if (a["sit_" + q.id]) sitResp[q.id] = a["sit_" + q.id]; });

      const { data: cand, error: insErr } = await supabase.from("candidatos_televendas").insert({
        vaga_id: vaga.id,
        nome: a.nome, email: a.email, celular: a.celular,
        endereco: a.endereco ?? null, setor_atual: a.setor ?? null, tempo_empresa: a.tempo ?? null,
        experiencia_texto: a.exp ?? null, motivacao_texto: a.motivo ?? null,
        cv_storage_path: cvPath, cv_nome_arquivo: a.cvNome ?? null,
        disc_respostas: discResp, disc_pontuacao: r.discPct,
        situacionais: sitResp, postura_score: r.sitAvg,
        perfil_key: r.key, perfil_nome: r.perfil.nome,
        match_final: r.finalMatch, match_label: r.label,
        lgpd_aceite: !!a.lgpd,
      }).select("id").single();
      if (insErr) throw insErr;

      setStep("resultado"); window.scrollTo({ top: 0, behavior: "smooth" });
      void rodarAnalise(cand!.id, cvPath, cvMime);
    } catch (err: any) {
      setSubmitError(err.message || "Erro ao enviar inscrição.");
    } finally { setSubmitting(false); }
  }

  async function rodarAnalise(candId: string, cvPath: string | null, cvMime: string | null) {
    setCvLoading(true); setCvError("");
    try {
      let textoBruto: string | null = null;
      if (cvFile && /\.docx?$/i.test(cvFile.name) && cvMime !== "application/pdf") {
        const mammoth = await import("mammoth");
        const ab = await cvFile.arrayBuffer();
        const r = await mammoth.extractRawText({ arrayBuffer: ab });
        textoBruto = r.value;
      }
      const parsed = await analisarCv({
        data: { storagePath: textoBruto ? null : cvPath, mimeType: textoBruto ? null : cvMime, textoExtra: textoExtra(), textoBruto, vagaContexto },
      });
      setCvAnalysis(parsed);
      await supabase.from("candidatos_televendas").update({ cv_analise: parsed }).eq("id", candId);
    } catch (e: any) {
      setCvError(e.message || "Não consegui analisar o currículo automaticamente.");
    } finally { setCvLoading(false); }
  }

  useEffect(() => { if (step !== "resultado") return; }, [step]);

  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      background: `radial-gradient(120% 80% at 50% -10%, ${ROXO_TINT} 0%, #FBFAFE 45%, #FFFFFF 100%)`,
      minHeight: "100vh", color: ROXO_DARK, padding: "0 0 48px",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} html,body{overflow-x:hidden;max-width:100vw} input:focus,select:focus,textarea:focus{border-color:${ROXO}!important;box-shadow:0 0 0 3px ${ROXO_TINT2}}
        .h{font-family:'Outfit',sans-serif} @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}
        [data-step-counter]{display:none}
        @media (max-width:640px){
          input,select,textarea{font-size:16px !important}
          [data-pad]{padding:0 12px !important}
          [data-grid]{grid-template-columns:1fr !important}
          [data-nav]{flex-direction:column-reverse !important;align-items:stretch !important;gap:10px}
          [data-nav] button{width:100% !important;justify-content:center !important;min-height:48px}
          [data-disc-row]{flex-wrap:wrap !important}
          [data-disc-row] > span{flex:1 1 100% !important;order:-1;margin-bottom:4px}
          [data-disc-row] > button{flex:1 1 calc(50% - 4px) !important;min-height:44px;justify-content:center;text-align:center}
          [data-mini-row]{flex-direction:column !important}
          [data-mini-row] > div{flex:1 1 auto !important;width:100%}
          [data-step-label]{display:none !important}
          [data-step-counter]{display:block !important}
          [data-step-circle]{width:24px !important;height:24px !important;border-width:2px !important}
          [data-header-sub]{display:none !important}
          [data-card]{padding:16px !important;border-radius:14px !important}
          [data-result-head]{flex-direction:column !important;align-items:center !important;text-align:center}
          [data-disc-bar-label]{width:72px !important;font-size:11px !important}
        }
      `}</style>

      <HeaderRoxo titulo={vaga.titulo} />

      <div data-pad style={{ maxWidth: 720, margin: "0 auto", padding: "0 18px" }}>
        {formIdx >= 0 && (
          <div style={{ margin: "22px 0 26px" }}>
            <div data-step-counter style={{ fontSize: 12, fontWeight: 700, color: ROXO, marginBottom: 8, letterSpacing: 1 }}>
              ETAPA {formIdx + 1} DE {FORM_STEPS.length} — {STEP_META[FORM_STEPS[formIdx]].n}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9, gap: 4 }}>
              {FORM_STEPS.map((s, i) => {
                const Ic = STEP_META[s].icon;
                const done = i < formIdx, cur = i === formIdx;
                return (
                  <div key={s} style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
                    <div data-step-circle style={{
                      width: 34, height: 34, borderRadius: 99, margin: "0 auto 5px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: done ? LARANJA : cur ? ROXO : "#fff",
                      border: `2px solid ${done ? LARANJA : cur ? ROXO : BORDA}`,
                      color: done || cur ? "#fff" : "#B6AECB",
                    }}>{done ? <CheckCircle2 size={15} /> : <Ic size={14} />}</div>
                    <div data-step-label style={{ fontSize: 10.5, fontWeight: cur ? 700 : 500, color: cur ? ROXO : "#9b93b0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{STEP_META[s].n}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ height: 4, background: BORDA, borderRadius: 9 }}>
              <div style={{ height: 4, borderRadius: 9, background: LARANJA, width: `${(formIdx / (FORM_STEPS.length - 1)) * 100}%`, transition: "width .3s" }} />
            </div>
          </div>
        )}

        {step === "intro" && (
          <Card>
            <Badge>{vaga.setor || "Vaga"}</Badge>
            <h1 className="h" style={{ fontSize: 27, fontWeight: 800, margin: "14px 0 8px", lineHeight: 1.15 }}>
              Quer fazer parte da vaga de <span style={{ color: LARANJA }}>{vaga.titulo}</span>?
            </h1>
            <p style={{ color: CINZA, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
              {vaga.descricao || "Este formulário abre o processo seletivo interno da Distribuidora Estrela. Responda com sinceridade — não existe resposta certa ou errada. 😊"}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, margin: "20px 0" }}>
              {[
                { i: FileText, t: "Currículo", d: "Análise automática da experiência" },
                { i: Brain, t: "Perfil DISC", d: "Seu estilo de comportamento" },
                { i: ShieldCheck, t: "Sigilo total", d: "Dados protegidos pela LGPD" },
              ].map((x) => (
                <div key={x.t} style={{ background: ROXO_TINT, borderRadius: 13, padding: 14 }}>
                  <x.i size={19} color={ROXO} />
                  <div className="h" style={{ fontWeight: 700, fontSize: 13.5, marginTop: 7 }}>{x.t}</div>
                  <div style={{ fontSize: 12, color: CINZA, marginTop: 2 }}>{x.d}</div>
                </div>
              ))}
            </div>
            <button type="button" onClick={next} style={{ background: LARANJA, color: "#fff", border: "none", padding: "13px 22px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", boxShadow: "0 6px 16px -6px " + LARANJA }}>
              Começar <ChevronRight size={18} />
            </button>
          </Card>
        )}

        {step === "dados" && (
          <Card>
            <Titulo icon={User} sub="Para entrarmos em contato com você.">Seus dados</Titulo>
            <Campo icon={User} label="Nome completo" obrig><input style={inputStyle} value={a.nome || ""} onChange={(e) => set("nome", e.target.value)} placeholder="Seu nome" /></Campo>
            <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Campo icon={Mail} label="E-mail" obrig><input style={inputStyle} type="email" value={a.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="voce@email.com" /></Campo>
              <Campo icon={Phone} label="Celular / WhatsApp" obrig><input style={inputStyle} value={a.celular || ""} onChange={(e) => set("celular", e.target.value)} placeholder="(96) 9 9999-9999" /></Campo>
            </div>
            <Campo icon={MapPin} label="Endereço (bairro e cidade)"><input style={inputStyle} value={a.endereco || ""} onChange={(e) => set("endereco", e.target.value)} placeholder="Bairro, Cidade - UF" /></Campo>
            <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Campo label="Setor / função atual"><input style={inputStyle} value={a.setor || ""} onChange={(e) => set("setor", e.target.value)} placeholder="Ex.: Estoque, Caixa..." /></Campo>
              <Campo label="Tempo de empresa">
                <select style={inputStyle} value={a.tempo || ""} onChange={(e) => set("tempo", e.target.value)}>
                  <option value="">Selecione</option><option>Menos de 6 meses</option><option>6 meses a 1 ano</option><option>1 a 3 anos</option><option>Mais de 3 anos</option>
                </select>
              </Campo>
            </div>
            <Nav back={back} next={next} pode={podeAvancar} />
          </Card>
        )}

        {step === "curriculo" && (
          <Card>
            <Titulo icon={FileText} sub="Atualize seu currículo. O sistema vai ler e analisar automaticamente.">Currículo & experiência</Titulo>
            <Campo icon={Upload} label="Anexar currículo (PDF, Word ou imagem)">
              <div style={{ border: `2px dashed ${cvFile ? ROXO : BORDA}`, borderRadius: 13, padding: 22, textAlign: "center", background: ROXO_TINT }}>
                <Upload size={26} color={ROXO} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: ROXO_DARK }}>{a.cvNome ? `📎 ${a.cvNome}` : "Clique para selecionar o arquivo"}</div>
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" style={{ marginTop: 10, fontSize: 12 }}
                  onChange={(e) => { const f = e.target.files && e.target.files[0]; set("cvNome", f ? f.name : ""); setCvFile(f || null); setCvAnalysis(null); setCvError(""); }} />
                <div style={{ fontSize: 11, color: CINZA, marginTop: 8 }}>Sem currículo pronto? Sem problema — preencha os campos abaixo que a análise usa o que você escrever.</div>
              </div>
            </Campo>
            <Campo label="Já trabalhou com algo relacionado à vaga? Conte rapidamente.">
              <textarea style={{ ...inputStyle, minHeight: 88, resize: "vertical" }} value={a.exp || ""} onChange={(e) => set("exp", e.target.value)} />
            </Campo>
            <Campo label="Por que você quer essa vaga?">
              <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={a.motivo || ""} onChange={(e) => set("motivo", e.target.value)} placeholder="Conte com suas palavras..." />
            </Campo>
            <Nav back={back} next={next} pode />
          </Card>
        )}

        {step === "situacional" && (
          <Card>
            <Titulo icon={MessageCircle} sub="Imagine que você já está na vaga. Escolha o que mais combina com você.">Situações reais de atendimento</Titulo>
            {SITUACIONAIS.map((q, i) => (
              <div key={q.id} style={{ marginBottom: 22 }}>
                <div className="h" style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 10, color: ROXO_DARK }}>
                  <span style={{ color: LARANJA }}>{i + 1}.</span> {q.titulo}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {q.options.map((o) => <Pill key={o.key} ativo={a["sit_" + q.id] === o.key} onClick={() => set("sit_" + q.id, o.key)}>{o.txt}</Pill>)}
                </div>
              </div>
            ))}
            <Nav back={back} next={next} pode={podeAvancar} aviso={!podeAvancar ? "Responda todas as situações para continuar." : ""} />
          </Card>
        )}

        {step === "disc" && (
          <Card>
            <Titulo icon={Brain} sub="Em cada bloco, marque a frase que MAIS combina e a que MENOS combina com você. Todas são qualidades.">Seu estilo</Titulo>
            {DISC_BLOCKS.map((b, bi) => (
              <div key={bi} style={{ marginBottom: 16, padding: 14, borderRadius: 14, background: ROXO_TINT }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, color: ROXO, marginBottom: 10 }}>
                  <span>BLOCO {bi + 1} DE {DISC_BLOCKS.length}</span><span style={{ color: CINZA, fontWeight: 600 }}>1 "Mais" + 1 "Menos"</span>
                </div>
                {b.opcoes.map((o, oi) => {
                  const mais = a["disc_" + bi + "_mais"] === oi;
                  const menos = a["disc_" + bi + "_menos"] === oi;
                  return (
                    <div key={oi} data-disc-row style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1.5px solid ${mais ? ROXO : menos ? LARANJA : BORDA}`, borderRadius: 11, padding: "7px 8px", marginBottom: 7 }}>
                      <button type="button" onClick={() => setMais(bi, oi)} style={tagBtn(mais, ROXO)}>+ Mais</button>
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: ROXO_DARK, lineHeight: 1.3 }}>{o.txt}</span>
                      <button type="button" onClick={() => setMenos(bi, oi)} style={tagBtn(menos, LARANJA)}>− Menos</button>
                    </div>
                  );
                })}
              </div>
            ))}
            <Nav back={back} next={next} pode={podeAvancar} aviso={!podeAvancar ? `Faltam ${DISC_BLOCKS.length - discDone} bloco(s) para completar.` : ""} />
          </Card>
        )}

        {step === "diversidade" && (
          <Card>
            <Titulo icon={Users} sub="Censo de diversidade da Estrela.">Diversidade & inclusão</Titulo>
            <div style={{ background: LARANJA_TINT, border: `1.5px solid ${LARANJA}33`, borderRadius: 12, padding: 14, display: "flex", gap: 11, marginBottom: 20 }}>
              <ShieldCheck size={20} color={LARANJA} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: ROXO_DARK, lineHeight: 1.55 }}>
                Esta etapa é <strong>100% opcional e sigilosa</strong>. As respostas <strong>não influenciam em nada</strong> a sua avaliação no processo — servem apenas para a empresa acompanhar a diversidade do time, conforme a LGPD. Você pode marcar <em>"Prefiro não responder"</em> em qualquer pergunta.
              </div>
            </div>
            <DivCampo label="Cor / raça (autodeclaração — padrão IBGE)" opts={COR_RACA} val={a.raca} on={(v: string) => set("raca", v)} />
            <DivCampo label="Identidade de gênero" opts={GENERO} val={a.genero} on={(v: string) => set("genero", v)} />
            <DivCampo label="Orientação sexual" opts={ORIENTACAO} val={a.orientacao} on={(v: string) => set("orientacao", v)} />
            <DivCampo label="Você é pessoa com deficiência (PCD)?" opts={PCD} val={a.pcd} on={(v: string) => set("pcd", v)} />
            <DivCampo label="Posicionamento político (autodeclaração)" opts={POLITICO} val={a.politico} on={(v: string) => set("politico", v)} />
            <Nav back={back} next={next} pode />
          </Card>
        )}

        {step === "revisao" && (
          <Card>
            <Titulo icon={CheckCircle2} sub="Confira antes de enviar.">Revisão</Titulo>
            <Linha k="Vaga" v={vaga.titulo} />
            <Linha k="Nome" v={a.nome} /><Linha k="E-mail" v={a.email} /><Linha k="Celular" v={a.celular} />
            <Linha k="Endereço" v={a.endereco || "—"} /><Linha k="Currículo" v={a.cvNome || "Não anexado"} />
            {vaga.usar_situacional && <Linha k="Situações respondidas" v={`${SITUACIONAIS.filter((q) => a["sit_" + q.id]).length}/${SITUACIONAIS.length}`} />}
            <Linha k="Blocos DISC respondidos" v={`${discDone}/${DISC_BLOCKS.length}`} />
            <label style={{ display: "flex", gap: 9, alignItems: "flex-start", margin: "18px 0", fontSize: 12.5, color: CINZA, lineHeight: 1.5 }}>
              <input type="checkbox" checked={!!a.lgpd} onChange={(e) => set("lgpd", e.target.checked)} style={{ marginTop: 2 }} />
              <span>Autorizo o uso dos meus dados pela Distribuidora Estrela exclusivamente para este processo seletivo interno, conforme a LGPD (Lei 13.709/2018).</span>
            </label>
            {submitError && <div style={{ fontSize: 12.5, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: 11, marginBottom: 10 }}>{submitError}</div>}
            <Nav back={back} next={next} pode={!!a.lgpd && !submitting} textoNext={submitting ? "Enviando..." : "Enviar inscrição"} aviso={!a.lgpd ? "Marque o consentimento para enviar." : ""} />
          </Card>
        )}

        {step === "resultado" && resultado && (
          <>
            <Card>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 58, height: 58, borderRadius: 99, background: LARANJA_TINT, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <ThumbsUp size={28} color={LARANJA} />
                </div>
                <h2 className="h" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Inscrição enviada, {(a.nome || "").split(" ")[0]}! 🎉</h2>
                <p style={{ color: CINZA, fontSize: 14, margin: 0, lineHeight: 1.55 }}>
                  Recebemos sua candidatura para <strong>{vaga.titulo}</strong>. O RH vai analisar e entrar em contato pelo e-mail e WhatsApp informados. Boa sorte!
                </p>
              </div>
            </Card>

            <div style={{ margin: "10px 0 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: ROXO, textTransform: "uppercase", letterSpacing: 1 }}>
              <BarChart3 size={15} /> Pré-visualização da análise
            </div>

            <Card>
              <div data-result-head style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, color: CINZA, fontWeight: 600 }}>Perfil comportamental identificado</div>
                  <div className="h" style={{ fontSize: 26, fontWeight: 800, color: resultado.perfil.cor, lineHeight: 1.1, margin: "3px 0" }}>{resultado.perfil.nome}</div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, background: ROXO_TINT, color: ROXO, padding: "3px 9px", borderRadius: 99 }}>{resultado.perfil.tag}</span>
                </div>
                <MatchRing match={resultado.finalMatch} label={resultado.label} />
              </div>
              <p style={{ fontSize: 14, color: CINZA, lineHeight: 1.6, marginTop: 14 }}>{resultado.perfil.resumo}</p>

              <div className="h" style={{ fontWeight: 700, fontSize: 13, margin: "16px 0 9px" }}>Mapa DISC</div>
              {(Object.keys(DIM_INFO) as Array<keyof typeof DIM_INFO>).map((d) => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div data-disc-bar-label style={{ width: 92, fontSize: 12, fontWeight: 600, color: ROXO_DARK }}>{DIM_INFO[d].nome}</div>
                  <div style={{ flex: 1, height: 14, background: "#F0EDF7", borderRadius: 9, overflow: "hidden" }}>
                    <div style={{ height: 14, width: `${resultado.discPct[d]}%`, background: DIM_INFO[d].cor, borderRadius: 9, transition: "width .5s" }} />
                  </div>
                  <div style={{ width: 38, textAlign: "right", fontSize: 12, fontWeight: 700, color: DIM_INFO[d].cor }}>{resultado.discPct[d]}%</div>
                </div>
              ))}

              <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                <Box titulo="Forças para a vaga" icon={Star} cor={LARANJA} items={resultado.perfil.forcas} />
                <Box titulo="Pontos de atenção" icon={Target} cor={ROXO} items={resultado.perfil.atencao} />
              </div>
              <div data-mini-row style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <Mini label="Postura no atendimento" v={`${resultado.sitAvg}%`} sub="Situações reais" />
                <Mini label="Aderência à vaga" v={`${resultado.finalMatch}%`} sub="60% perfil + 40% postura" />
              </div>
            </Card>

            <Card>
              <Titulo icon={FileText} sub="Leitura automática do currículo e da experiência informada.">Análise de currículo</Titulo>
              {cvLoading && <div style={{ display: "flex", alignItems: "center", gap: 10, color: ROXO, fontSize: 14, fontWeight: 600, padding: "10px 0" }}><Loader2 size={20} className="spin" /> Lendo e analisando o currículo...</div>}
              {cvError && !cvLoading && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 14, fontSize: 13, color: "#B91C1C" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={17} /> {cvError}</div>
                </div>
              )}
              {cvAnalysis && !cvLoading && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 12.5, color: CINZA, fontWeight: 600 }}>Aderência do histórico à vaga:</span>
                    <NivelBadge nivel={cvAnalysis.aderencia_televendas} />
                    {cvAnalysis.anos_relevantes && <span style={{ fontSize: 12, color: "#9b93b0" }}>· {cvAnalysis.anos_relevantes}</span>}
                  </div>
                  <p style={{ fontSize: 14, color: ROXO_DARK, lineHeight: 1.6, margin: "0 0 16px" }}>{cvAnalysis.resumo}</p>
                  {(cvAnalysis.experiencias || []).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div className="h" style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 9, color: ROXO_DARK }}><Briefcase size={15} color={ROXO} /> Experiências identificadas</div>
                      {cvAnalysis.experiencias.map((ex: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 12px", border: `1px solid ${BORDA}`, borderRadius: 11, marginBottom: 7 }}>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: ROXO_DARK }}>{ex.cargo || "—"}{ex.empresa ? ` · ${ex.empresa}` : ""}</div>
                            {ex.periodo && <div style={{ fontSize: 11.5, color: "#9b93b0" }}>{ex.periodo}</div>}
                          </div>
                          <NivelBadge nivel={ex.relevancia} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Box titulo="Pontos fortes" icon={Star} cor={VERDE} items={cvAnalysis.pontos_fortes} />
                    <Box titulo="Lacunas / a desenvolver" icon={AlertCircle} cor={LARANJA} items={cvAnalysis.lacunas} />
                  </div>
                  {(cvAnalysis.perguntas_entrevista || []).length > 0 && (
                    <div style={{ marginTop: 14, background: ROXO_TINT, borderRadius: 12, padding: 14 }}>
                      <div className="h" style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 9, color: ROXO_DARK }}><Lightbulb size={15} color={ROXO} /> Sugestões para a entrevista</div>
                      {cvAnalysis.perguntas_entrevista.map((q: string, i: number) => <div key={i} style={{ fontSize: 12.5, color: CINZA, marginBottom: 6, display: "flex", gap: 6 }}><span style={{ color: ROXO }}>{i + 1}.</span> {q}</div>)}
                    </div>
                  )}
                </div>
              )}
            </Card>

            <div style={{ background: "#F0EDF7", borderRadius: 12, padding: 14, display: "flex", gap: 11, fontSize: 12, color: CINZA, lineHeight: 1.55 }}>
              <ShieldCheck size={18} color={ROXO} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>A aderência usa <strong>somente</strong> DISC + situações + experiência. Cor/raça, gênero, orientação sexual, PCD e posicionamento político <strong>não entram na pontuação</strong> — ficam só no painel de diversidade, em conformidade com a LGPD.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
