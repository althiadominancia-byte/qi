import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Users, TrendingUp, Award, ChevronRight, X, Phone, Mail,
  Briefcase, Star, AlertCircle, Lightbulb, BarChart3, ShieldCheck,
  Calendar, Headphones, Filter, FileText, LogOut,
} from "lucide-react";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { supabase } from "@/integrations/supabase/client";
import {
  ROXO, ROXO_DARK, ROXO_TINT, LARANJA, LARANJA_TINT, CINZA, BORDA, VERDE,
  PERFIS, DIM_INFO, labelMatch, corMatch, corNivel, txtNivel,
} from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel do Recrutador · Estrela" }] }),
  component: AdminPage,
});

type Candidato = {
  id: string;
  created_at: string;
  nome: string;
  email: string;
  celular: string;
  setor_atual: string | null;
  perfil_key: string | null;
  perfil_nome: string | null;
  match_final: number | null;
  match_label: string | null;
  postura_score: number | null;
  disc_pontuacao: any;
  cv_analise: any;
  cv_storage_path: string | null;
  cv_nome_arquivo: string | null;
  experiencia_texto: string | null;
};

type DivRow = { raca: string | null; genero: string | null; orientacao: string | null; pcd: string | null; politico: string | null };

function AdminPage() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<"candidatos" | "diversidade">("candidatos");
  const [busca, setBusca] = useState("");
  const [fPerfil, setFPerfil] = useState<string>("todos");
  const [fMatch, setFMatch] = useState(0);
  const [ordem, setOrdem] = useState("match_desc");
  const [sel, setSel] = useState<Candidato | null>(null);

  const candidatosQ = useQuery({
    queryKey: ["candidatos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidatos_televendas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Candidato[];
    },
  });

  const diversidadeQ = useQuery({
    queryKey: ["diversidade"],
    queryFn: async () => {
      const { data, error } = await supabase.from("diversidade_candidatos").select("raca,genero,orientacao,pcd,politico").limit(1000);
      if (error) throw error;
      return (data ?? []) as DivRow[];
    },
    enabled: aba === "diversidade",
  });

  const lista = useMemo(() => {
    const all = candidatosQ.data ?? [];
    let l = all.filter((c) =>
      c.nome.toLowerCase().includes(busca.toLowerCase()) &&
      (fPerfil === "todos" || c.perfil_key === fPerfil) &&
      (c.match_final ?? 0) >= fMatch
    );
    l = [...l].sort((x, y) => {
      const xm = x.match_final ?? 0, ym = y.match_final ?? 0;
      if (ordem === "match_desc") return ym - xm;
      if (ordem === "match_asc") return xm - ym;
      if (ordem === "nome") return x.nome.localeCompare(y.nome);
      return new Date(y.created_at).getTime() - new Date(x.created_at).getTime();
    });
    return l;
  }, [candidatosQ.data, busca, fPerfil, fMatch, ordem]);

  const total = candidatosQ.data?.length ?? 0;
  const matchMedio = total > 0
    ? Math.round((candidatosQ.data ?? []).reduce((s, c) => s + (c.match_final ?? 0), 0) / total)
    : 0;
  const nAlto = (candidatosQ.data ?? []).filter((c) => (c.match_final ?? 0) >= 70).length;

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK, paddingBottom: 40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} .h{font-family:'Outfit',sans-serif}
        input:focus,select:focus{outline:none;border-color:${ROXO}!important;box-shadow:0 0 0 3px ${ROXO_TINT}}
      `}</style>

      <div style={{ background: ROXO, padding: "15px 22px", display: "flex", alignItems: "center", gap: 12 }}>
        <MarcaEstrela size={32} branca />
        <div style={{ lineHeight: 1 }}>
          <div className="h" style={{ color: "#fff", fontWeight: 700, letterSpacing: 2, fontSize: 10.5, opacity: 0.85 }}>DISTRIBUIDORA ESTRELA</div>
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Painel do Recrutador</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center", color: "#fff" }}>
          <span style={{ fontSize: 12, opacity: 0.8, display: "flex", alignItems: "center", gap: 6 }}><Headphones size={15} /> Televendas</span>
          <button onClick={sair} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><LogOut size={13} /> Sair</button>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 18px" }}>
        <div style={{ display: "flex", gap: 6, margin: "18px 0" }}>
          {([["candidatos", "Candidatos", Users], ["diversidade", "Diversidade (agregado)", BarChart3]] as const).map(([k, t, Ic]) => (
            <button key={k} onClick={() => setAba(k as any)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
              fontSize: 13.5, fontWeight: 700, border: `1.5px solid ${aba === k ? ROXO : BORDA}`,
              background: aba === k ? ROXO : "#fff", color: aba === k ? "#fff" : CINZA,
            }}><Ic size={15} /> {t}</button>
          ))}
        </div>

        {candidatosQ.isError && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 14, marginBottom: 14, color: "#B91C1C", fontSize: 13 }}>
            Não foi possível carregar candidatos. Verifique se você tem o papel de recrutador.
            <pre style={{ fontSize: 11, marginTop: 8 }}>{String((candidatosQ.error as any)?.message ?? "")}</pre>
          </div>
        )}

        {aba === "candidatos" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
              <ResumoCard icon={Users} cor={ROXO} v={total} l="Inscritos" />
              <ResumoCard icon={TrendingUp} cor={LARANJA} v={`${matchMedio}%`} l="Match médio" />
              <ResumoCard icon={Award} cor={VERDE} v={nAlto} l="Match alto (≥70%)" />
            </div>

            <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div style={{ position: "relative", flex: "1 1 200px" }}>
                <Search size={15} color="#9b93b0" style={{ position: "absolute", left: 11, top: 11 }} />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome..."
                  style={{ width: "100%", padding: "9px 12px 9px 32px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13.5, fontFamily: "inherit", color: ROXO_DARK }} />
              </div>
              <Sel val={fPerfil} on={setFPerfil} ops={[["todos", "Todos os perfis"], ...Object.entries(PERFIS).map(([k, p]) => [k, p.nome] as [string, string])]} />
              <Sel val={String(fMatch)} on={(v) => setFMatch(Number(v))} ops={[["0", "Qualquer match"], ["55", "Match ≥ 55%"], ["70", "Match ≥ 70%"], ["85", "Match ≥ 85%"]]} />
              <Sel val={ordem} on={setOrdem} ops={[["match_desc", "Maior match"], ["match_asc", "Menor match"], ["recentes", "Mais recentes"], ["nome", "Nome (A-Z)"]]} />
            </div>

            <div style={{ fontSize: 12, color: CINZA, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Filter size={13} /> {lista.length} candidato(s)</div>

            <div style={{ display: "grid", gap: 9 }}>
              {candidatosQ.isLoading && <div style={{ textAlign: "center", color: CINZA, padding: 30 }}>Carregando...</div>}
              {!candidatosQ.isLoading && lista.map((c) => {
                const p = c.perfil_key && (PERFIS as any)[c.perfil_key] as any;
                const match = c.match_final ?? 0;
                return (
                  <button type="button" key={c.id} onClick={() => setSel(c)} style={{
                    display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                    background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 13, padding: "13px 16px",
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: 99, background: ROXO_TINT, color: ROXO, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }} className="h">
                      {c.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="h" style={{ fontWeight: 700, fontSize: 15, color: ROXO_DARK }}>{c.nome}</div>
                      <div style={{ fontSize: 12, color: "#9b93b0", display: "flex", gap: 10, marginTop: 2 }}>
                        <span>{c.setor_atual || "—"}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Calendar size={11} /> {new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    {p && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: p.cor, padding: "4px 10px", borderRadius: 99, flexShrink: 0 }}>{p.nome}</span>}
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 70 }}>
                      <div className="h" style={{ fontSize: 19, fontWeight: 800, color: corMatch(match) }}>{match}%</div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: corMatch(match) }}>{labelMatch(match)}</div>
                    </div>
                    <ChevronRight size={18} color="#C9C1DC" />
                  </button>
                );
              })}
              {!candidatosQ.isLoading && lista.length === 0 && <div style={{ textAlign: "center", color: CINZA, padding: 30, fontSize: 14 }}>Nenhum candidato com esses filtros.</div>}
            </div>
          </>
        )}

        {aba === "diversidade" && <Diversidade rows={diversidadeQ.data ?? []} loading={diversidadeQ.isLoading} />}
      </div>

      {sel && <Detalhe c={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function Detalhe({ c, onClose }: { c: Candidato; onClose: () => void }) {
  const p = c.perfil_key ? (PERFIS as any)[c.perfil_key] : null;
  const match = c.match_final ?? 0;
  const disc = c.disc_pontuacao || {};
  const cv = c.cv_analise;
  const [cvUrl, setCvUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!c.cv_storage_path) return;
    supabase.storage.from("curriculos").createSignedUrl(c.cv_storage_path, 300).then(({ data }) => {
      if (data?.signedUrl) setCvUrl(data.signedUrl);
    });
  }, [c.cv_storage_path]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(58,37,102,.45)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px,100%)", background: "#FBFAFE", height: "100%", overflowY: "auto", boxShadow: "-10px 0 40px rgba(0,0,0,.2)" }}>
        <div style={{ background: ROXO, padding: "18px 22px", display: "flex", alignItems: "center", gap: 13, position: "sticky", top: 0, zIndex: 2 }}>
          <div style={{ width: 46, height: 46, borderRadius: 99, background: "#fff", color: ROXO, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16 }} className="h">
            {c.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div style={{ flex: 1 }}>
            <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 19 }}>{c.nome}</div>
            <div style={{ color: "#fff", opacity: 0.85, fontSize: 12.5 }}>{c.setor_atual || "—"}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 9, width: 34, height: 34, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: CINZA, marginBottom: 18 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Mail size={14} color={ROXO} /> {c.email}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone size={14} color={ROXO} /> {c.celular}</span>
          </div>

          <Bloco>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: CINZA, fontWeight: 600 }}>Perfil comportamental</div>
                <div className="h" style={{ fontSize: 23, fontWeight: 800, color: p?.cor ?? ROXO, lineHeight: 1.1, margin: "3px 0" }}>{p?.nome ?? c.perfil_nome ?? "—"}</div>
                {p && <span style={{ fontSize: 11.5, fontWeight: 700, background: ROXO_TINT, color: ROXO, padding: "3px 9px", borderRadius: 99 }}>{p.tag}</span>}
              </div>
              <Ring m={match} />
            </div>
            <div style={{ marginTop: 14 }}>
              {(Object.keys(DIM_INFO) as Array<keyof typeof DIM_INFO>).map((d) => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                  <div style={{ width: 92, fontSize: 12, fontWeight: 600 }}>{DIM_INFO[d].nome}</div>
                  <div style={{ flex: 1, height: 13, background: "#F0EDF7", borderRadius: 9, overflow: "hidden" }}>
                    <div style={{ height: 13, width: `${disc[d] ?? 0}%`, background: DIM_INFO[d].cor, borderRadius: 9 }} />
                  </div>
                  <div style={{ width: 34, textAlign: "right", fontSize: 12, fontWeight: 700, color: DIM_INFO[d].cor }}>{disc[d] ?? 0}%</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <MiniDet l="Postura no atendimento" v={`${c.postura_score ?? 0}%`} />
              <MiniDet l="Aderência à vaga" v={`${match}%`} />
            </div>
          </Bloco>

          {c.cv_nome_arquivo && (
            <Bloco>
              <Cab icon={FileText} t="Currículo enviado" />
              <div style={{ fontSize: 13, color: CINZA, marginBottom: 8 }}>📎 {c.cv_nome_arquivo}</div>
              {cvUrl && <a href={cvUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: ROXO, color: "#fff", padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Abrir currículo</a>}
            </Bloco>
          )}

          {cv && (
            <Bloco>
              <Cab icon={FileText} t="Análise de currículo (IA)" />
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px" }}>
                <span style={{ fontSize: 12.5, color: CINZA, fontWeight: 600 }}>Aderência do histórico:</span>
                <BadgeN n={cv.aderencia_televendas} />
                {cv.anos_relevantes && <span style={{ fontSize: 12, color: "#9b93b0" }}>· {cv.anos_relevantes}</span>}
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: ROXO_DARK, margin: "0 0 14px" }}>{cv.resumo}</p>
              {(cv.experiencias || []).length > 0 && (
                <>
                  <Sub icon={Briefcase} t="Experiências" />
                  {cv.experiencias.map((e: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 11px", border: `1px solid ${BORDA}`, borderRadius: 10, marginBottom: 6, background: "#fff" }}>
                      <div><div style={{ fontSize: 13, fontWeight: 600 }}>{e.cargo} · {e.empresa}</div><div style={{ fontSize: 11, color: "#9b93b0" }}>{e.periodo}</div></div>
                      <BadgeN n={e.relevancia} />
                    </div>
                  ))}
                </>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                <BoxList t="Pontos fortes" icon={Star} cor={VERDE} items={cv.pontos_fortes} />
                <BoxList t="Lacunas" icon={AlertCircle} cor={LARANJA} items={cv.lacunas} />
              </div>
              {(cv.perguntas_entrevista || []).length > 0 && (
                <div style={{ marginTop: 12, background: ROXO_TINT, borderRadius: 11, padding: 13 }}>
                  <Sub icon={Lightbulb} t="Sugestões para a entrevista" cor={ROXO} />
                  {cv.perguntas_entrevista.map((q: string, i: number) => <div key={i} style={{ fontSize: 12.5, color: CINZA, marginBottom: 5, display: "flex", gap: 6 }}><span style={{ color: ROXO }}>{i + 1}.</span> {q}</div>)}
                </div>
              )}
            </Bloco>
          )}

          <div style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 11.5, color: "#9b93b0", marginTop: 4 }}>
            <ShieldCheck size={14} /> Dados de diversidade não são exibidos nesta ficha (LGPD / antidiscriminação).
          </div>
        </div>
      </div>
    </div>
  );
}

function Diversidade({ rows, loading }: { rows: DivRow[]; loading: boolean }) {
  if (loading) return <div style={{ textAlign: "center", padding: 30, color: CINZA }}>Carregando...</div>;
  const N = rows.length;
  const dist = (campo: keyof DivRow) => {
    const m: Record<string, number> = {};
    rows.forEach((c) => { const v = c[campo]; if (v) m[v] = (m[v] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const grupos: [string, keyof DivRow][] = [
    ["Cor / raça", "raca"], ["Identidade de gênero", "genero"],
    ["Orientação sexual", "orientacao"], ["Pessoa com deficiência", "pcd"], ["Posicionamento político", "politico"],
  ];
  return (
    <>
      <div style={{ background: LARANJA_TINT, border: `1.5px solid ${LARANJA}33`, borderRadius: 12, padding: 14, display: "flex", gap: 11, marginBottom: 16 }}>
        <ShieldCheck size={20} color={LARANJA} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: ROXO_DARK, lineHeight: 1.55 }}>
          Dados <strong>agregados e anônimos</strong>, com base em {N} inscritos. Não estão vinculados a candidatos individuais
          e <strong>não influenciam a seleção</strong> — servem apenas ao acompanhamento de diversidade, conforme a LGPD.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        {grupos.map(([titulo, campo]) => (
          <div key={campo} style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16 }}>
            <div className="h" style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: ROXO_DARK }}>{titulo}</div>
            {N > 0 && dist(campo).map(([k, v]) => (
              <div key={k} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ color: k === "Prefiro não responder" ? "#9b93b0" : ROXO_DARK }}>{k}</span>
                  <span style={{ fontWeight: 700, color: ROXO }}>{v} · {Math.round((v / N) * 100)}%</span>
                </div>
                <div style={{ height: 8, background: "#F0EDF7", borderRadius: 9 }}>
                  <div style={{ height: 8, width: `${(v / N) * 100}%`, background: k === "Prefiro não responder" ? "#C9C1DC" : ROXO, borderRadius: 9 }} />
                </div>
              </div>
            ))}
            {N === 0 && <div style={{ fontSize: 12, color: CINZA }}>Sem dados ainda.</div>}
          </div>
        ))}
      </div>
    </>
  );
}

function ResumoCard({ icon: Icon, cor, v, l }: any) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: cor + "18", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 9 }}><Icon size={18} color={cor} /></div>
      <div className="h" style={{ fontSize: 24, fontWeight: 800, color: ROXO_DARK, lineHeight: 1 }}>{v}</div>
      <div style={{ fontSize: 12, color: CINZA, marginTop: 3 }}>{l}</div>
    </div>
  );
}
function Sel({ val, on, ops }: { val: string; on: (v: string) => void; ops: [string, string][] }) {
  return (
    <select value={val} onChange={(e) => on(e.target.value)} style={{ padding: "9px 12px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13, fontFamily: "inherit", color: ROXO_DARK, background: "#fff", cursor: "pointer" }}>
      {ops.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  );
}
function Bloco({ children }: any) { return <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>{children}</div>; }
function Cab({ icon: Icon, t }: any) { return <div className="h" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15, marginBottom: 12, color: ROXO_DARK }}><Icon size={17} color={ROXO} /> {t}</div>; }
function Sub({ icon: Icon, t, cor = ROXO_DARK }: any) { return <div className="h" style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12.5, margin: "0 0 8px", color: cor }}><Icon size={14} color={cor} /> {t}</div>; }
function BadgeN({ n }: any) { return <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: corNivel(n), padding: "2px 9px", borderRadius: 99 }}>{txtNivel(n)}</span>; }
function BoxList({ t, icon: Icon, cor, items }: any) {
  return (
    <div style={{ background: ROXO_TINT, borderRadius: 11, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12, color: cor, marginBottom: 8 }}><Icon size={13} /> {t}</div>
      {(items || []).map((x: string, i: number) => <div key={i} style={{ fontSize: 12, color: CINZA, marginBottom: 5, display: "flex", gap: 6 }}><span style={{ color: cor }}>•</span> {x}</div>)}
    </div>
  );
}
function MiniDet({ l, v }: any) {
  return <div style={{ flex: 1, border: `1px solid ${BORDA}`, borderRadius: 11, padding: "10px 13px" }}>
    <div style={{ fontSize: 11.5, color: CINZA, fontWeight: 600 }}>{l}</div>
    <div className="h" style={{ fontSize: 20, fontWeight: 800, color: ROXO, lineHeight: 1.1, marginTop: 2 }}>{v}</div>
  </div>;
}
function Ring({ m }: { m: number }) {
  const r = 32, c = 2 * Math.PI * r, cor = corMatch(m);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="86" height="86" viewBox="0 0 86 86">
        <circle cx="43" cy="43" r={r} fill="none" stroke="#EEEAF6" strokeWidth="8" />
        <circle cx="43" cy="43" r={r} fill="none" stroke={cor} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * m) / 100} transform="rotate(-90 43 43)" />
        <text x="43" y="40" textAnchor="middle" fontSize="21" fontWeight="800" fill={cor} fontFamily="Outfit">{m}%</text>
        <text x="43" y="54" textAnchor="middle" fontSize="8.5" fill="#888">match</text>
      </svg>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: cor, marginTop: -3 }}>{labelMatch(m)}</div>
    </div>
  );
}
