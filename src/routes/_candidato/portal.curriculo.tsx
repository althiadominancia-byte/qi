import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Printer, RefreshCw, Loader2 } from "lucide-react";
import { getMeuCurriculoGerado, gerarMeuCurriculo } from "@/lib/portal-candidato.functions";
import { ROXO, ROXO_DARK, CINZA, BORDA } from "@/lib/recrutamento/data";

// /portal/curriculo — currículo criado a partir do perfil neutro, com download
// em PDF via impressão do navegador (@media print, zero dependências).

export const Route = createFileRoute("/_candidato/portal/curriculo")({
  head: () => ({ meta: [{ title: "Meu currículo — Portal do Candidato" }] }),
  component: CurriculoPage,
});

function CurriculoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchCv = useServerFn(getMeuCurriculoGerado);
  const regerar = useServerFn(gerarMeuCurriculo);
  const [regenerando, setRegenerando] = useState(false);
  const [erro, setErro] = useState("");

  const cvQ = useQuery({
    queryKey: ["meu-curriculo-gerado"],
    queryFn: () => fetchCv() as Promise<any>,
    retry: false,
  });
  const cv = cvQ.data?.cv;

  async function onRegerar() {
    setRegenerando(true);
    setErro("");
    try {
      await regerar();
      await qc.invalidateQueries({ queryKey: ["meu-curriculo-gerado"] });
    } catch (e: any) {
      setErro(e?.message || "Não foi possível gerar agora.");
    } finally {
      setRegenerando(false);
    }
  }

  if (cvQ.isLoading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: CINZA }}>
        <Loader2 size={22} className="spin" /> Carregando...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 16px 60px" }}>
      {/* Estilos de impressão: só a folha do currículo sai no PDF */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #folha-cv, #folha-cv * { visibility: visible; }
          #folha-cv { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; margin: 0 !important; }
          @page { size: A4; margin: 18mm 16mm; }
        }
      `}</style>

      <div
        className="nao-imprime"
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <button
          onClick={() => navigate({ to: "/portal/perfil" as any })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "none",
            border: "none",
            color: CINZA,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            padding: "8px 0",
          }}
        >
          <ChevronLeft size={16} /> Meu perfil
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={onRegerar}
          disabled={regenerando}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "#fff",
            color: ROXO,
            border: `1.5px solid ${BORDA}`,
            padding: "10px 14px",
            borderRadius: 11,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {regenerando ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Atualizar
          com meu perfil
        </button>
        {cv && (
          <button
            onClick={() => window.print()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: ROXO,
              color: "#fff",
              border: "none",
              padding: "10px 16px",
              borderRadius: 11,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Printer size={14} /> Baixar em PDF
          </button>
        )}
      </div>

      {erro && (
        <div
          style={{
            fontSize: 13,
            color: "#B91C1C",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 11,
            padding: 12,
            marginBottom: 14,
          }}
        >
          {erro}
        </div>
      )}

      {!cv ? (
        <div
          style={{
            background: "#fff",
            border: `1px solid ${BORDA}`,
            borderRadius: 16,
            padding: 28,
            textAlign: "center",
            color: CINZA,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          Você ainda não criou seu currículo.
          <br />
          Monte seu perfil primeiro e clique em <strong>"Atualizar com meu perfil"</strong> aqui em
          cima.
        </div>
      ) : (
        <div
          id="folha-cv"
          style={{
            background: "#fff",
            border: `1px solid ${BORDA}`,
            borderRadius: 4,
            padding: "36px 40px",
            boxShadow: "0 8px 30px -14px rgba(0,0,0,.25)",
            color: "#1a1a1a",
            fontFamily: "Georgia, 'Times New Roman', serif",
            lineHeight: 1.5,
          }}
        >
          {/* Cabeçalho */}
          <h1 style={{ fontSize: 26, margin: "0 0 2px", fontWeight: 700, letterSpacing: 0.3 }}>
            {cv.cabecalho?.nome || "—"}
          </h1>
          <div style={{ fontSize: 12.5, color: "#555", marginBottom: 18 }}>
            {[cv.cabecalho?.email, cv.cabecalho?.celular].filter(Boolean).join(" · ")}
          </div>

          {cv.objetivo && (
            <SecaoCv titulo="Objetivo">
              <p style={{ margin: 0 }}>{cv.objetivo}</p>
            </SecaoCv>
          )}
          {cv.resumo && (
            <SecaoCv titulo="Resumo">
              <p style={{ margin: 0 }}>{cv.resumo}</p>
            </SecaoCv>
          )}
          {(cv.experiencias ?? []).length > 0 && (
            <SecaoCv titulo="Experiência">
              {(cv.experiencias ?? []).map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {e.titulo}
                    {e.organizacao ? ` — ${e.organizacao}` : ""}
                  </div>
                  {e.periodo && <div style={{ fontSize: 12, color: "#666" }}>{e.periodo}</div>}
                  {e.descricao && <div style={{ fontSize: 13, marginTop: 2 }}>{e.descricao}</div>}
                </div>
              ))}
            </SecaoCv>
          )}
          {(cv.formacao ?? []).length > 0 && (
            <SecaoCv titulo="Formação e cursos">
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {(cv.formacao ?? []).map((f: string, i: number) => (
                  <li key={i} style={{ marginBottom: 3 }}>
                    {f}
                  </li>
                ))}
              </ul>
            </SecaoCv>
          )}
          {(cv.habilidades ?? []).length > 0 && (
            <SecaoCv titulo="Habilidades">
              <p style={{ margin: 0, fontSize: 13 }}>{(cv.habilidades ?? []).join(" · ")}</p>
            </SecaoCv>
          )}
        </div>
      )}

      {cv && cvQ.data?.atualizado_em && (
        <p
          className="nao-imprime"
          style={{ fontSize: 11.5, color: "#9b93b0", textAlign: "center", marginTop: 12 }}
        >
          Gerado a partir do seu perfil em{" "}
          {new Date(cvQ.data.atualizado_em).toLocaleDateString("pt-BR")} — para personalizar, edite
          seu perfil e atualize.
        </p>
      )}
    </div>
  );
}

function SecaoCv({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          borderBottom: "1.5px solid #ddd",
          paddingBottom: 4,
          margin: "0 0 8px",
          fontWeight: 700,
          color: ROXO_DARK,
        }}
      >
        {titulo}
      </h2>
      {children}
    </div>
  );
}
