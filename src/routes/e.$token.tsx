import { createFileRoute } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Video, ShieldCheck, Check, Loader2, AlertCircle, Mic, Camera, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandingStyle, logoUrl } from "@/components/BrandingStyle";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { registrarConsentimento, emitirTokenSalaCandidato } from "@/lib/entrevista.functions";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE } from "@/lib/recrutamento/data";

const TERMO_VERSAO = "1.0";
const SalaVideo = lazy(() => import("@/components/SalaVideo"));

export const Route = createFileRoute("/e/$token")({
  ssr: false, // sala de vídeo (livekit-client) roda só no cliente
  head: () => ({ meta: [{ title: "Entrevista por vídeo" }] }),
  component: EntrevistaPublica,
});

function EntrevistaPublica() {
  const { token } = Route.useParams();
  const consentir = useServerFn(registrarConsentimento);
  const entQ = useQuery({
    queryKey: ["entrevista-token", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_entrevista_por_token" as any, { p_token: token });
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      return row ?? null;
    },
  });

  const emitir = useServerFn(emitirTokenSalaCandidato);
  const [aceito, setAceito] = useState(false);
  const [resultado, setResultado] = useState<null | "aceito" | "recusado">(null);
  const [enviando, setEnviando] = useState(false);
  const [sala, setSala] = useState<{ url: string; token: string } | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrarNaSala() {
    setEntrando(true);
    try { const t: any = await emitir({ data: { token } }); setSala({ url: t.url, token: t.token }); }
    catch (e: any) { alert(e?.message || "Falha ao entrar na sala."); }
    finally { setEntrando(false); }
  }

  const ent = entQ.data;
  const branding = ent ? { cor_primaria: ent.cor_primaria, cor_sidebar: ent.cor_sidebar, cor_botao: ent.cor_botao } : undefined;
  const logo = logoUrl(ent?.logo_path);
  const marca = ent?.empresa_nome as string | undefined;

  async function responder(consentiu: boolean) {
    setEnviando(true);
    try {
      await consentir({ data: { token, consentiu, versao_termo: TERMO_VERSAO } });
      setResultado(consentiu ? "aceito" : "recusado");
    } catch (e: any) {
      alert(e?.message || "Falha ao registrar a resposta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .h{font-family:'Outfit',sans-serif} @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}`}</style>
      {branding && <BrandingStyle cor_primaria={branding.cor_primaria} cor_sidebar={branding.cor_sidebar} cor_botao={branding.cor_botao} />}

      <div style={{ background: ROXO, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 30 }}>
        <MarcaEstrela size={32} branca src={logo} alt={marca || "Recrutamento"} />
        <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>{marca || "Entrevista por vídeo"}</div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 18px" }}>
        {entQ.isLoading ? (
          <div style={{ textAlign: "center", color: CINZA, marginTop: 40 }}>Carregando…</div>
        ) : !ent ? (
          <Card>
            <div style={{ textAlign: "center" }}>
              <AlertCircle size={36} color={LARANJA} />
              <h2 className="h" style={{ fontSize: 21, fontWeight: 800, marginTop: 10 }}>Link inválido</h2>
              <p style={{ color: CINZA, fontSize: 14 }}>Esta entrevista não foi encontrada ou o link expirou.</p>
            </div>
          </Card>
        ) : resultado === "aceito" ? (
          <Card>
            <div style={{ textAlign: "center" }}>
              <Video size={34} color={ROXO} />
              <h2 className="h" style={{ fontSize: 21, fontWeight: 800, marginTop: 10 }}>Tudo pronto</h2>
              <p style={{ color: CINZA, fontSize: 14, lineHeight: 1.6 }}>
                Obrigado! Entre na sala quando estiver pronto{ent.vaga_titulo ? <> — vaga <strong>{ent.vaga_titulo}</strong></> : null}.
              </p>
              <button onClick={entrarNaSala} disabled={entrando} style={{
                margin: "16px auto 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: entrando ? "#D8D2E6" : LARANJA, color: "#fff", border: "none",
                padding: "13px 22px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: entrando ? "wait" : "pointer", fontFamily: "inherit",
              }}>
                {entrando ? <Loader2 size={17} className="spin" /> : <Video size={17} />} Entrar na sala
              </button>
              <div style={{ marginTop: 14, background: ROXO_TINT, borderRadius: 10, padding: 12, fontSize: 12.5, color: ROXO_DARK }}>
                Você pode revogar seu consentimento a qualquer momento respondendo ao recrutador.
              </div>
            </div>
          </Card>
        ) : resultado === "recusado" ? (
          <Card>
            <div style={{ textAlign: "center" }}>
              <ShieldCheck size={34} color={VERDE} />
              <h2 className="h" style={{ fontSize: 21, fontWeight: 800, marginTop: 10 }}>Tudo certo</h2>
              <p style={{ color: CINZA, fontSize: 14, lineHeight: 1.6 }}>
                Sua entrevista será feita <strong>sem gravação</strong> e sem análise por IA — você não é prejudicado por isso.
                O recrutador entrará em contato com os próximos passos.
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <h1 className="h" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Entrevista por vídeo</h1>
            <p style={{ color: CINZA, fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
              Nesta etapa do processo seletivo da <strong>{marca || "empresa"}</strong>{ent.vaga_titulo ? <> para <strong>{ent.vaga_titulo}</strong></> : null}, a entrevista é por vídeo.
              Com o seu consentimento, ela poderá ser <strong>gravada</strong> e ter a <strong>fala analisada por IA</strong> para apoiar a avaliação.
            </p>

            <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
              <Item icon={Mic} t="Voz" d="A fala da entrevista é gravada e transcrita." />
              <Item icon={Camera} t="Vídeo e imagem" d="A imagem é gravada durante a chamada." />
              <Item icon={Brain} t="Análise por IA (de conteúdo)" d="A IA analisa o CONTEÚDO da sua fala — não julga rosto nem emoções." />
            </div>

            <div style={{ background: ROXO_TINT, borderRadius: 12, padding: 14, fontSize: 12.8, color: ROXO_DARK, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>Como seus dados são tratados (LGPD):</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                <li>Finalidade: exclusivamente <strong>este processo seletivo</strong>.</li>
                <li>Acesso: apenas a equipe de recrutamento da empresa.</li>
                <li>Retenção: a gravação é apagada em até <strong>90 dias</strong>.</li>
                <li>A <strong>decisão é sempre humana</strong> — a IA só apoia; você pode pedir revisão.</li>
                <li>Você pode <strong>revogar</strong> o consentimento a qualquer momento.</li>
              </ul>
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: ROXO_DARK, cursor: "pointer", marginBottom: 16 }}>
              <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Li e <strong>concordo</strong> com a gravação de voz, vídeo e imagem e com o tratamento dos meus dados para esta finalidade, conforme a LGPD (Lei 13.709/2018).</span>
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => responder(true)} disabled={!aceito || enviando} style={{
                flex: "1 1 220px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: !aceito || enviando ? "#D8D2E6" : LARANJA, color: "#fff", border: "none",
                padding: "13px 18px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: !aceito || enviando ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}>
                {enviando ? <Loader2 size={17} className="spin" /> : <Check size={17} />} Concordo e continuar
              </button>
              <button onClick={() => responder(false)} disabled={enviando} style={{
                flex: "1 1 160px", background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`,
                padding: "13px 18px", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>
                Prefiro sem gravação
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "#9b93b0", marginTop: 12, textAlign: "center" }}>
              Recusar não prejudica sua participação — a entrevista acontece sem gravação.
            </div>
          </Card>
        )}
      </div>

      {sala && (
        <Suspense fallback={null}>
          <SalaVideo url={sala.url} token={sala.token} onSair={() => setSala(null)} />
        </Suspense>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 18, padding: 24, boxShadow: "0 8px 30px -14px rgba(80,50,138,.16)" }}>{children}</div>;
}
function Item({ icon: Ic, t, d }: { icon: any; t: string; d: string }) {
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: ROXO_TINT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic size={17} color={ROXO} /></div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: ROXO_DARK }}>{t}</div>
        <div style={{ fontSize: 12.5, color: CINZA, lineHeight: 1.5 }}>{d}</div>
      </div>
    </div>
  );
}
