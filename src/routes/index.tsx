import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, LogIn, ShieldCheck } from "lucide-react";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Recrutamento — Distribuidora Estrela" },
      { name: "description", content: "Plataforma interna de recrutamento da Distribuidora Estrela." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", minHeight: "100vh", background: `radial-gradient(120% 80% at 50% -10%, ${ROXO_TINT} 0%, #FBFAFE 45%, #FFFFFF 100%)`, color: ROXO_DARK }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'); .h{font-family:'Outfit',sans-serif}`}</style>
      <div style={{ background: ROXO, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <MarcaEstrela size={34} branca />
        <div style={{ lineHeight: 1 }}>
          <div className="h" style={{ color: "#fff", fontWeight: 700, letterSpacing: 2, fontSize: 11, opacity: 0.85 }}>DISTRIBUIDORA</div>
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 19, letterSpacing: 1 }}>ESTRELA</div>
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: "60px auto 0", padding: "0 18px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: ROXO_TINT, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Briefcase size={30} color={ROXO} />
        </div>
        <h1 className="h" style={{ fontSize: 30, fontWeight: 800, margin: "0 0 12px" }}>Recrutamento interno</h1>
        <p style={{ color: CINZA, fontSize: 15, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 28px" }}>
          Esta é a plataforma interna de recrutamento da Distribuidora Estrela. As inscrições acontecem pelo
          <strong> link específico de cada vaga </strong> — peça o link ao RH.
        </p>
        <Link to="/auth" style={{
          display: "inline-flex", alignItems: "center", gap: 8, background: LARANJA, color: "#fff",
          padding: "13px 22px", borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: "none",
          boxShadow: "0 6px 16px -6px " + LARANJA,
        }}>
          <LogIn size={17} /> Acesso do recrutador
        </Link>
        <div style={{ marginTop: 40, padding: 16, border: `1px solid ${BORDA}`, borderRadius: 14, background: "#fff", maxWidth: 520, marginLeft: "auto", marginRight: "auto", display: "flex", gap: 11, textAlign: "left" }}>
          <ShieldCheck size={20} color={ROXO} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12.5, color: CINZA, lineHeight: 1.55 }}>
            Os dados coletados são tratados em conformidade com a <strong>LGPD</strong>. Cor/raça, gênero, orientação
            sexual, PCD e posicionamento político não influenciam a avaliação.
          </div>
        </div>
      </div>
    </div>
  );
}
