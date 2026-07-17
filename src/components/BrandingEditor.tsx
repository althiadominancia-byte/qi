// Editor de identidade visual (white-label) de uma empresa.
// Reutilizado em dois lugares: no card de cada empresa (super.tsx, super_admin)
// e na página /identidade (admin_empresa edita a própria empresa).

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Save, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrandingEmpresa, atualizarBrandingEmpresa } from "@/lib/empresas.functions";
import { logoUrl } from "@/components/BrandingStyle";
import {
  ROXO,
  ROXO_DARK,
  LARANJA,
  CINZA,
  BORDA,
  VERDE,
  VERMELHO,
  MARCA_DEFAULT,
} from "@/lib/recrutamento/data";

const LOGO_MAX_MB = 2;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
const HEX = /^#[0-9a-fA-F]{6}$/;

export function BrandingEditor({
  empresaId,
  onSaved,
}: {
  empresaId: string;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const fetchBranding = useServerFn(getBrandingEmpresa);
  const salvarFn = useServerFn(atualizarBrandingEmpresa);

  const q = useQuery({
    queryKey: ["branding", empresaId],
    queryFn: () => fetchBranding({ data: { empresaId } }),
  });

  const [primaria, setPrimaria] = useState<string>(MARCA_DEFAULT.primary);
  const [sidebar, setSidebar] = useState<string>(MARCA_DEFAULT.sidebar);
  const [botao, setBotao] = useState<string>(MARCA_DEFAULT.accent);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza os campos quando os dados chegam.
  useEffect(() => {
    if (!q.data) return;
    setPrimaria(q.data.cor_primaria || MARCA_DEFAULT.primary);
    setSidebar(q.data.cor_sidebar || MARCA_DEFAULT.sidebar);
    setBotao(q.data.cor_botao || MARCA_DEFAULT.accent);
    setLogoPath(q.data.logo_path ?? null);
  }, [q.data]);

  const previewLogo = useMemo(
    () => (file ? URL.createObjectURL(file) : logoUrl(logoPath)),
    [file, logoPath],
  );
  useEffect(
    () => () => {
      if (file && previewLogo) URL.revokeObjectURL(previewLogo);
    },
    [file, previewLogo],
  );

  function escolherArquivo(f: File | null) {
    setErro(null);
    if (!f) return;
    if (!LOGO_TYPES.includes(f.type)) {
      setErro("Formato não suportado. Use PNG, JPG, WEBP ou SVG.");
      return;
    }
    if (f.size > LOGO_MAX_MB * 1024 * 1024) {
      setErro(`Arquivo muito grande. O limite é ${LOGO_MAX_MB} MB.`);
      return;
    }
    setFile(f);
  }

  function restaurarPadrao() {
    setPrimaria(MARCA_DEFAULT.primary);
    setSidebar(MARCA_DEFAULT.sidebar);
    setBotao(MARCA_DEFAULT.accent);
  }

  const coresValidas = HEX.test(primaria) && HEX.test(sidebar) && HEX.test(botao);

  async function salvar() {
    if (saving || !coresValidas) return;
    setSaving(true);
    setErro(null);
    setOkMsg(false);
    try {
      let path = logoPath;
      if (file) {
        const ext = (file.name.split(".").pop() || "png").toLowerCase();
        const nome = `${empresaId}/logo-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("logos")
          .upload(nome, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error("Falha no upload da logo: " + upErr.message);
        path = nome;
      }
      await salvarFn({
        data: {
          empresaId,
          cor_primaria: primaria,
          cor_sidebar: sidebar,
          cor_botao: botao,
          logo_path: path,
        },
      });
      setLogoPath(path);
      setFile(null);
      setOkMsg(true);
      qc.invalidateQueries({ queryKey: ["branding", empresaId] });
      qc.invalidateQueries({ queryKey: ["my-scope"] });
      qc.invalidateQueries({ queryKey: ["super:empresas"] });
      onSaved?.();
    } catch (e: any) {
      setErro(e?.message || "Erro ao salvar identidade visual.");
    } finally {
      setSaving(false);
    }
  }

  if (q.isLoading) {
    return (
      <div style={{ fontSize: 13, color: CINZA, padding: "8px 0" }}>Carregando identidade...</div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Logo */}
      <div>
        <div style={lbl}>Logo</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              border: `1px solid ${BORDA}`,
              background: sidebar,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {previewLogo ? (
              <img
                src={previewLogo}
                alt="Logo"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)" }}>sem logo</span>
            )}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <input
              ref={inputRef}
              type="file"
              accept={LOGO_TYPES.join(",")}
              style={{ display: "none" }}
              onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
            />
            <button type="button" onClick={() => inputRef.current?.click()} style={btnSec}>
              <Upload size={15} /> {logoPath || file ? "Trocar logo" : "Enviar logo"}
            </button>
            <span style={{ fontSize: 11, color: "#9b93b0" }}>
              PNG, JPG, WEBP ou SVG · até {LOGO_MAX_MB} MB.
            </span>
          </div>
        </div>
      </div>

      {/* Cores */}
      <div style={{ display: "grid", gap: 12 }}>
        <CorRow label="Cor primária / marca" value={primaria} onChange={setPrimaria} />
        <CorRow label="Cor da sidebar" value={sidebar} onChange={setSidebar} />
        <CorRow label="Cor de botão / ação" value={botao} onChange={setBotao} />
      </div>

      {/* Preview */}
      <div>
        <div style={lbl}>Prévia</div>
        <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
          <div
            style={{
              width: 120,
              borderRadius: 12,
              background: sidebar,
              padding: 12,
              color: "#fff",
              display: "grid",
              gap: 8,
              alignContent: "start",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Menu</div>
            <div
              style={{
                background: primaria,
                borderRadius: 8,
                padding: "7px 9px",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Item ativo
            </div>
            <div style={{ padding: "7px 9px", fontSize: 11, opacity: 0.8 }}>Outro item</div>
          </div>
          <div
            style={{
              flex: "1 1 180px",
              border: `1px solid ${BORDA}`,
              borderRadius: 12,
              padding: 14,
              display: "grid",
              gap: 10,
              alignContent: "start",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: primaria }}>Título de destaque</div>
            <div style={{ fontSize: 12, color: CINZA }}>Texto de exemplo do conteúdo.</div>
            <button
              type="button"
              style={{
                background: botao,
                color: "#fff",
                border: "none",
                padding: "9px 14px",
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: 700,
                width: "fit-content",
                cursor: "default",
                fontFamily: "inherit",
              }}
            >
              Ação principal
            </button>
          </div>
        </div>
      </div>

      {erro && <div style={{ fontSize: 12.5, color: VERMELHO, fontWeight: 600 }}>{erro}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={salvar}
          disabled={saving || !coresValidas}
          style={{
            ...btnLaranja,
            opacity: saving || !coresValidas ? 0.55 : 1,
            cursor: saving || !coresValidas ? "not-allowed" : "pointer",
          }}
        >
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Salvar identidade
        </button>
        <button type="button" onClick={restaurarPadrao} style={btnSec}>
          <RotateCcw size={14} /> Cores padrão
        </button>
        {okMsg && <span style={{ fontSize: 12.5, color: VERDE, fontWeight: 700 }}>Salvo!</span>}
      </div>
    </div>
  );
}

function CorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valida = HEX.test(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <input
        type="color"
        value={valida ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 44,
          height: 40,
          border: `1px solid ${BORDA}`,
          borderRadius: 10,
          background: "#fff",
          cursor: "pointer",
          padding: 2,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: ROXO_DARK }}>{label}</div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="#RRGGBB"
          style={{
            marginTop: 4,
            width: 120,
            padding: "7px 10px",
            border: `1.5px solid ${valida ? BORDA : VERMELHO}`,
            borderRadius: 9,
            fontSize: 13,
            fontFamily: "monospace",
            color: ROXO_DARK,
            background: "#fff",
          }}
        />
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: ROXO_DARK,
  marginBottom: 8,
};
const btnLaranja: React.CSSProperties = {
  background: LARANJA,
  color: "#fff",
  border: "none",
  padding: "10px 16px",
  borderRadius: 11,
  fontSize: 13.5,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontFamily: "inherit",
};
const btnSec: React.CSSProperties = {
  background: "#fff",
  color: ROXO,
  border: `1.5px solid ${BORDA}`,
  padding: "9px 14px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "inherit",
  width: "fit-content",
};
