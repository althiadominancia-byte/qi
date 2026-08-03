import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Send, Loader2, UserRound, X, CheckCircle2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { useFeatures } from "@/lib/recrutamento/use-features";
import { listarPoolTalentos, enviarConvite, cancelarConvite } from "@/lib/talentos.functions";
import { ROXO, ROXO_DARK, ROXO_TINT, BORDA, CINZA, LARANJA, VERDE } from "@/lib/recrutamento/data";

// Banco de Talentos (modelo empresa-puxa): perfis ÀS CEGAS do pool — a empresa
// vê competências/formação/preferências, NUNCA nome/contato/currículo. O fit
// vira CONVITE; os dados aparecem só quando o candidato aceita no portal.

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

  const [vagaId, setVagaId] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [modal, setModal] = useState<any>(null); // perfil selecionado p/ convite
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const vagasQ = useQuery({
    queryKey: ["vagas-abertas-convite"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vagas")
        .select("id, titulo, setor")
        .eq("status", "Aberta")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const fetchPool = useServerFn(listarPoolTalentos);
  const poolQ = useQuery({
    queryKey: ["pool-talentos", vagaId, buscaAplicada],
    queryFn: () =>
      fetchPool({
        data: { vagaId: vagaId || null, busca: buscaAplicada || null },
      }) as Promise<any>,
    enabled: !!scope && podeAcessar,
    retry: false,
  });
  const convidar = useServerFn(enviarConvite);
  const cancelar = useServerFn(cancelarConvite);

  async function onEnviarConvite() {
    if (!modal || !vagaId) return;
    setEnviando(true);
    setErro("");
    try {
      await convidar({
        data: { contaId: modal.conta_id, vagaId, mensagem: mensagem.trim() || null } as any,
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
        Perfis às cegas: você vê competências, formação e preferências — os dados pessoais só
        aparecem quando o candidato <strong>aceita o convite</strong>. Selecione a vaga e convide
        quem tem fit.
      </p>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <select
          value={vagaId}
          onChange={(e) => setVagaId(e.target.value)}
          style={{ ...inp, minWidth: 260 }}
        >
          <option value="">Selecione a vaga para convidar...</option>
          {(vagasQ.data ?? []).map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.titulo} {v.setor ? `— ${v.setor}` : ""}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 8, flex: "1 1 260px" }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="Buscar por competência, área, cidade..."
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
      </div>

      {poolQ.isLoading && (
        <div style={{ padding: 40, textAlign: "center", color: CINZA }}>
          <Loader2 size={20} className="spin" /> Carregando o pool...
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
          }}
        >
          Nenhum perfil disponível no pool ainda. Os candidatos aparecem aqui quando montam o perfil
          no portal e ativam “quero ser encontrado por empresas”.
        </div>
      )}

      {/* Grid de perfis cegos */}
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
                </div>
                {p.cidade && <div style={{ fontSize: 12, color: CINZA }}>{p.cidade}</div>}
              </div>
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
            <div style={{ marginTop: "auto" }}>
              {p.convite_status === "pendente" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: LARANJA }}>
                    Convite enviado — aguardando resposta
                  </span>
                  {podeConvidar && (
                    <button
                      onClick={() =>
                        cancelar({ data: { contaId: p.conta_id, vagaId } as any }).then(() =>
                          qc.invalidateQueries({ queryKey: ["pool-talentos"] }),
                        )
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: CINZA,
                        fontSize: 11.5,
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      cancelar
                    </button>
                  )}
                </div>
              ) : p.convite_status === "aceito" ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: VERDE }}>
                  <CheckCircle2 size={13} /> Aceitou — já está na vaga
                </span>
              ) : p.convite_status === "recusado" ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: CINZA }}>
                  Recusou o convite
                </span>
              ) : (
                podeConvidar && (
                  <button
                    onClick={() => {
                      setErro("");
                      setModal(p);
                    }}
                    disabled={!vagaId}
                    title={!vagaId ? "Selecione a vaga primeiro" : undefined}
                    style={{
                      background: vagaId ? ROXO : "#D8D2E6",
                      color: "#fff",
                      border: "none",
                      padding: "9px 15px",
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: vagaId ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: "inherit",
                    }}
                  >
                    <Send size={13} /> Convidar para a vaga
                  </button>
                )
              )}
            </div>
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
                Convidar Talento {modal.iniciais}
              </h3>
              <button
                onClick={() => setModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: CINZA }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: CINZA, margin: "0 0 12px", lineHeight: 1.5 }}>
              Vaga:{" "}
              <strong>
                {(vagasQ.data ?? []).find((v: any) => v.id === vagaId)?.titulo ?? "—"}
              </strong>
              . O candidato recebe o convite no portal e, se aceitar, entra na vaga com o perfil
              completo.
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
