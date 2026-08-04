import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Send, Loader2, UserRound, X, CheckCircle2, Sparkles, Video } from "lucide-react";
import { getMyScope } from "@/lib/scope.functions";
import { useFeatures } from "@/lib/recrutamento/use-features";
import { listarPoolTalentos, enviarConvite, cancelarConvite } from "@/lib/talentos.functions";
import { ROXO, ROXO_DARK, ROXO_TINT, BORDA, CINZA, LARANJA, VERDE } from "@/lib/recrutamento/data";

// Banco de Talentos (modelo empresa-puxa, dirigido pelo MOTOR):
// mostra SÓ talentos com match nas vagas ABERTAS da empresa — o recrutador
// não escolhe vaga, o fit já vem calculado (QinMatch → convites.status
// 'sugerido' + match_score). Perfis às cegas: nome/contato/currículo só
// aparecem quando o candidato ACEITA o convite.

export const Route = createFileRoute("/_authenticated/talentos")({
  head: () => ({ meta: [{ title: "Banco de Talentos" }] }),
  component: TalentosPage,
});

const inp: React.CSSProperties = {
  padding: "10px 12px",
  border: `1.5px solid ${BORDA}`,
  borderRadius: 10,
  fontSize: 13.5,
  outline: "none",
  background: "#fff",
  color: ROXO_DARK,
  fontFamily: "inherit",
};

const TIPOS_EXP: Record<string, string> = {
  formal: "Formal",
  informal: "Informal",
  voluntariado: "Voluntariado",
  projeto: "Projeto",
  curso: "Curso",
};

const STATUS_SUG: Record<string, { rotulo: string; cor: string }> = {
  pendente: { rotulo: "Convite enviado", cor: LARANJA },
  aceito: { rotulo: "Aceitou ✓", cor: VERDE },
  recusado: { rotulo: "Recusou", cor: CINZA },
};

function TalentosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";

  const { has } = useFeatures();
  const podeAcessar = (isSuper || !!scope?.perms?.ver_candidatos) && has("banco_talentos");
  useEffect(() => {
    if (scopeQ.isSuccess && scope && !podeAcessar) navigate({ to: "/admin", replace: true });
  }, [scopeQ.isSuccess, scope, podeAcessar, navigate]);
  const podeConvidar = isSuper || !!scope?.perms?.gerenciar_vagas;

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  // Convite é por (talento, vaga com match): o modal carrega os dois.
  const [modal, setModal] = useState<{ perfil: any; vaga: any } | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const fetchPool = useServerFn(listarPoolTalentos);
  const poolQ = useQuery({
    queryKey: ["pool-talentos", buscaAplicada],
    queryFn: () => fetchPool({ data: { busca: buscaAplicada || null } }) as Promise<any>,
    enabled: !!scope && podeAcessar,
    retry: false,
  });
  const convidar = useServerFn(enviarConvite);
  const cancelar = useServerFn(cancelarConvite);

  async function onEnviarConvite() {
    if (!modal) return;
    setEnviando(true);
    setErro("");
    try {
      await convidar({
        data: {
          contaId: modal.perfil.conta_id,
          vagaId: modal.vaga.vaga_id,
          mensagem: mensagem.trim() || null,
        } as any,
      });
      setModal(null);
      setMensagem("");
      await qc.invalidateQueries({ queryKey: ["pool-talentos"] });
    } catch (e: any) {
      setErro(e?.message || "Não foi possível enviar o convite.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ padding: "22px 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <UserRound size={22} color={ROXO} />
        <h1 className="h" style={{ fontSize: 22, fontWeight: 800, color: ROXO_DARK, margin: 0 }}>
          Banco de Talentos
        </h1>
      </div>
      <p style={{ fontSize: 13, color: CINZA, margin: "0 0 18px", lineHeight: 1.55 }}>
        O QinMatch cruza suas <strong>vagas abertas</strong> com o pool e mostra aqui só quem tem
        fit — perfis às cegas: os dados pessoais aparecem quando o candidato{" "}
        <strong>aceita o convite</strong>.
      </p>

      {/* Busca */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, maxWidth: 480 }}>
        <input
          style={{ ...inp, flex: 1 }}
          placeholder="Filtrar por competência, área, cidade..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setBuscaAplicada(busca)}
        />
        <button
          onClick={() => setBuscaAplicada(busca)}
          style={{
            background: ROXO,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "0 14px",
            cursor: "pointer",
          }}
        >
          <Search size={16} />
        </button>
      </div>

      {poolQ.isLoading && (
        <div style={{ padding: 40, textAlign: "center", color: CINZA }}>
          <Loader2 size={20} className="spin" /> Cruzando o pool com suas vagas...
        </div>
      )}
      {poolQ.isError && (
        <div
          style={{
            fontSize: 13,
            color: "#B91C1C",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 11,
            padding: 14,
          }}
        >
          {(poolQ.error as any)?.message ?? "Não foi possível carregar o pool."}
        </div>
      )}
      {poolQ.data && (poolQ.data.perfis ?? []).length === 0 && (
        <div
          style={{
            background: "#fff",
            border: `1px solid ${BORDA}`,
            borderRadius: 14,
            padding: 30,
            textAlign: "center",
            color: CINZA,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {poolQ.data.sem_vagas ? (
            <>Nenhuma vaga aberta — o banco mostra talentos com fit nas suas vagas abertas.</>
          ) : (
            <>
              O motor ainda não encontrou talentos com fit nas suas vagas abertas.
              <br />
              As sugestões aparecem aqui automaticamente conforme o QinMatch roda sobre o pool.
            </>
          )}
        </div>
      )}

      {/* Grid de perfis cegos, ordenados pelo melhor fit */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 14,
        }}
      >
        {(poolQ.data?.perfis ?? []).map((p: any) => (
          <div
            key={p.conta_id}
            style={{
              background: "#fff",
              border: `1px solid ${BORDA}`,
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 99,
                  background: ROXO_TINT,
                  color: ROXO,
                  fontWeight: 800,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {p.iniciais}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: ROXO_DARK }}>
                  Talento {p.iniciais}
                  {p.tem_cv && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        color: VERDE,
                        background: "#F0FDF4",
                        padding: "2px 7px",
                        borderRadius: 99,
                      }}
                    >
                      CV
                    </span>
                  )}
                  {p.tem_video && (
                    <span
                      style={{
                        marginLeft: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        color: ROXO,
                        background: ROXO_TINT,
                        padding: "2px 7px",
                        borderRadius: 99,
                      }}
                    >
                      <Video size={9} /> vídeo
                    </span>
                  )}
                </div>
                {p.cidade && <div style={{ fontSize: 12, color: CINZA }}>{p.cidade}</div>}
              </div>
            </div>

            {/* Fit por vaga aberta (calculado pelo motor) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {p.vagas_match.map((vm: any) => (
                <div
                  key={vm.vaga_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#FAF9FD",
                    border: `1px solid ${BORDA}`,
                    borderRadius: 10,
                    padding: "8px 10px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: ROXO_DARK,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {vm.vaga_titulo ?? "Vaga"}
                  </span>
                  {typeof vm.match_score === "number" && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: vm.match_score >= 75 ? VERDE : LARANJA,
                      }}
                    >
                      {Math.round(vm.match_score)}%
                    </span>
                  )}
                  {vm.status === "sugerido" ? (
                    podeConvidar && (
                      <button
                        onClick={() => {
                          setErro("");
                          setModal({ perfil: p, vaga: vm });
                        }}
                        style={{
                          background: ROXO,
                          color: "#fff",
                          border: "none",
                          padding: "6px 11px",
                          borderRadius: 8,
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Send size={11} /> Convidar
                      </button>
                    )
                  ) : (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: STATUS_SUG[vm.status]?.cor ?? CINZA,
                        whiteSpace: "nowrap",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      {vm.status === "aceito" && <CheckCircle2 size={12} />}
                      {STATUS_SUG[vm.status]?.rotulo ?? vm.status}
                      {vm.status === "pendente" && podeConvidar && (
                        <button
                          onClick={() =>
                            cancelar({
                              data: { contaId: p.conta_id, vagaId: vm.vaga_id } as any,
                            }).then(() => qc.invalidateQueries({ queryKey: ["pool-talentos"] }))
                          }
                          style={{
                            background: "none",
                            border: "none",
                            color: CINZA,
                            fontSize: 11,
                            cursor: "pointer",
                            textDecoration: "underline",
                            padding: 0,
                          }}
                        >
                          cancelar
                        </button>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {p.resumo && (
              <p style={{ fontSize: 12.5, color: CINZA, margin: 0, lineHeight: 1.5 }}>
                <Sparkles size={11} color={LARANJA} /> {p.resumo}
              </p>
            )}
            {p.competencias.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {p.competencias.slice(0, 6).map((c: any, i: number) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: ROXO_DARK,
                      background: ROXO_TINT,
                      padding: "3px 9px",
                      borderRadius: 99,
                    }}
                  >
                    {c.nome} {"●".repeat(Math.min(5, c.nivel ?? 0))}
                  </span>
                ))}
              </div>
            )}
            {p.experiencias.length > 0 && (
              <div style={{ fontSize: 12, color: CINZA, lineHeight: 1.5 }}>
                {p.experiencias
                  .slice(0, 3)
                  .map(
                    (e: any) =>
                      `${e.titulo} (${TIPOS_EXP[e.tipo] ?? e.tipo}${e.validada ? " ✓" : ""})`,
                  )
                  .join(" · ")}
              </div>
            )}
            {p.formacoes.length > 0 && (
              <div style={{ fontSize: 12, color: CINZA }}>
                🎓 {p.formacoes.map((f: any) => f.titulo).join(" · ")}
              </div>
            )}
            {p.preferencias && (
              <div style={{ fontSize: 11.5, color: "#9b93b0" }}>
                {[
                  p.preferencias.disponibilidade,
                  p.preferencias.modelo_trabalho,
                  (p.preferencias.interesses ?? []).slice(0, 3).join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal de convite */}
      {modal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,10,40,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 16,
          }}
          onClick={() => !enviando && setModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 22,
              width: "100%",
              maxWidth: 460,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 800, color: ROXO_DARK, margin: 0 }}>
                Convidar Talento {modal.perfil.iniciais}
              </h3>
              <button
                onClick={() => setModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: CINZA }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: CINZA, margin: "0 0 12px", lineHeight: 1.5 }}>
              Vaga: <strong>{modal.vaga.vaga_titulo ?? "—"}</strong>
              {typeof modal.vaga.match_score === "number"
                ? ` (fit ${Math.round(modal.vaga.match_score)}%)`
                : ""}
              . O candidato recebe o convite no portal e por e-mail; aceitando, entra na vaga com o
              perfil completo.
            </p>
            <textarea
              rows={3}
              placeholder="Mensagem (opcional): por que vocês têm fit?"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value.slice(0, 600))}
              style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
            {erro && <div style={{ fontSize: 12.5, color: "#B91C1C", marginTop: 8 }}>{erro}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button
                onClick={() => setModal(null)}
                disabled={enviando}
                style={{
                  background: "none",
                  border: "none",
                  color: CINZA,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={onEnviarConvite}
                disabled={enviando}
                style={{
                  background: enviando ? "#D8D2E6" : ROXO,
                  color: "#fff",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: enviando ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontFamily: "inherit",
                }}
              >
                {enviando ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                Enviar convite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
