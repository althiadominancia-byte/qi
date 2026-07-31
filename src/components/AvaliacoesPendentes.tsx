import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Brain, CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react";
import { salvarMinhasAvaliacoes } from "@/lib/portal-candidato.functions";
import {
  ROXO,
  ROXO_DARK,
  ROXO_TINT,
  LARANJA,
  CINZA,
  BORDA,
  VERDE,
  type DiscBlock,
  type Situacao,
} from "@/lib/recrutamento/data";

// Avaliações pendentes do TITULAR (portal do candidato): completa o DISC e as
// questões situacionais que ficaram faltando na inscrição, com a MESMA
// linguagem visual do funil público (c.$token.tsx). O servidor recalcula tudo.

type Props = {
  candidatoId: string;
  config: { blocos: DiscBlock[]; situacoes: Situacao[] } | null;
  discPendente: boolean;
  sitPendente: boolean;
  onConcluido: () => void;
};

const tagBtn = (on: boolean, cor: string): React.CSSProperties => ({
  flexShrink: 0,
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: 11.5,
  fontWeight: 700,
  cursor: "pointer",
  border: `1.5px solid ${on ? cor : BORDA}`,
  background: on ? cor : "#fff",
  color: on ? "#fff" : CINZA,
  fontFamily: "inherit",
});

function Pill({ ativo, onClick, children }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 11,
        fontSize: 13.5,
        cursor: "pointer",
        textAlign: "left",
        border: `1.5px solid ${ativo ? ROXO : BORDA}`,
        background: ativo ? ROXO_TINT : "#fff",
        color: ativo ? ROXO_DARK : CINZA,
        fontWeight: ativo ? 600 : 500,
        fontFamily: "inherit",
        lineHeight: 1.35,
      }}
    >
      {children}
    </button>
  );
}

function SubTitulo({ icon: Icon, sub, children }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        className="h"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 15,
          fontWeight: 800,
          color: ROXO_DARK,
        }}
      >
        <Icon size={16} color={ROXO} /> {children}
      </div>
      {sub && (
        <div style={{ fontSize: 12.5, color: CINZA, marginTop: 4, lineHeight: 1.5 }}>{sub}</div>
      )}
    </div>
  );
}

export function AvaliacoesPendentes({
  candidatoId,
  config,
  discPendente,
  sitPendente,
  onConcluido,
}: Props) {
  const salvar = useServerFn(salvarMinhasAvaliacoes);
  const [respostas, setRespostas] = useState<Record<string, number | string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [concluido, setConcluido] = useState(false);

  const blocos = discPendente ? (config?.blocos ?? []) : [];
  const situacoes = sitPendente ? (config?.situacoes ?? []) : [];

  // Mesma regra do funil: "+ Mais" e "− Menos" nunca ficam na mesma frase.
  const setMais = (bi: number, oi: number) =>
    setRespostas((p) => {
      const n = { ...p };
      n[`disc_${bi}_mais`] = oi;
      if (n[`disc_${bi}_menos`] === oi) delete n[`disc_${bi}_menos`];
      return n;
    });
  const setMenos = (bi: number, oi: number) =>
    setRespostas((p) => {
      const n = { ...p };
      n[`disc_${bi}_menos`] = oi;
      if (n[`disc_${bi}_mais`] === oi) delete n[`disc_${bi}_mais`];
      return n;
    });

  const discDone = blocos.filter(
    (_b, bi) =>
      respostas[`disc_${bi}_mais`] !== undefined && respostas[`disc_${bi}_menos`] !== undefined,
  ).length;
  const discCompleto = !discPendente || discDone === blocos.length;
  const sitCompleto = !sitPendente || situacoes.every((_q, i) => respostas[`sit_${i}`]);
  const pode = discCompleto && sitCompleto && !enviando;

  async function onEnviar() {
    if (!pode) return;
    setEnviando(true);
    setErro("");
    try {
      await salvar({ data: { candidatoId, respostas } });
      setConcluido(true);
      onConcluido();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível registrar sua avaliação. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: 12,
          padding: 14,
          color: VERDE,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        <CheckCircle2 size={18} /> Avaliação registrada!
      </div>
    );
  }

  return (
    <div>
      {sitPendente && situacoes.length > 0 && (
        <div style={{ marginBottom: blocos.length ? 22 : 6 }}>
          <SubTitulo
            icon={MessageCircle}
            sub="Imagine que você já está na vaga. Escolha o que mais combina com você."
          >
            Situações reais de atendimento
          </SubTitulo>
          {situacoes.map((q, i) => (
            <div key={i} style={{ marginBottom: 22 }}>
              <div
                className="h"
                style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 10, color: ROXO_DARK }}
              >
                <span style={{ color: LARANJA }}>{i + 1}.</span> {q.titulo}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {q.options.map((o, oi) => (
                  <Pill
                    key={oi}
                    ativo={respostas[`sit_${i}`] === "o" + oi}
                    onClick={() => setRespostas((p) => ({ ...p, [`sit_${i}`]: "o" + oi }))}
                  >
                    {o.txt}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {discPendente && blocos.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <SubTitulo
            icon={Brain}
            sub="Em cada bloco, marque a frase que MAIS combina e a que MENOS combina com você. Todas são qualidades."
          >
            Seu estilo
          </SubTitulo>
          {blocos.map((b, bi) => (
            <div
              key={bi}
              style={{ marginBottom: 16, padding: 14, borderRadius: 14, background: ROXO_TINT }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: ROXO,
                  marginBottom: 10,
                }}
              >
                <span>
                  BLOCO {bi + 1} DE {blocos.length}
                </span>
                <span style={{ color: CINZA, fontWeight: 600 }}>1 "Mais" + 1 "Menos"</span>
              </div>
              {b.opcoes.map((o, oi) => {
                const mais = respostas[`disc_${bi}_mais`] === oi;
                const menos = respostas[`disc_${bi}_menos`] === oi;
                return (
                  <div
                    key={oi}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#fff",
                      border: `1.5px solid ${mais ? ROXO : menos ? LARANJA : BORDA}`,
                      borderRadius: 11,
                      padding: "7px 8px",
                      marginBottom: 7,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setMais(bi, oi)}
                      style={tagBtn(mais, ROXO)}
                    >
                      + Mais
                    </button>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: ROXO_DARK,
                        lineHeight: 1.3,
                      }}
                    >
                      {o.txt}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMenos(bi, oi)}
                      style={tagBtn(menos, LARANJA)}
                    >
                      − Menos
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {erro && (
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
          {erro}
        </div>
      )}
      {!pode && !enviando && (
        <div style={{ fontSize: 12.5, color: CINZA, marginBottom: 10, lineHeight: 1.5 }}>
          {!discCompleto
            ? `Faltam ${blocos.length - discDone} bloco(s) para completar.`
            : !sitCompleto
              ? "Responda todas as situações para enviar."
              : ""}
        </div>
      )}
      <button
        onClick={onEnviar}
        disabled={!pode}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: pode ? ROXO : "#D8D2E6",
          color: "#fff",
          border: "none",
          padding: "12px 20px",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          cursor: enviando ? "wait" : pode ? "pointer" : "not-allowed",
          fontFamily: "inherit",
          minHeight: 46,
        }}
      >
        {enviando ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Enviar avaliação
      </button>
    </div>
  );
}
