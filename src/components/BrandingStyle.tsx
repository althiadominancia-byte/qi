// Injeta as CSS variables de marca (white-label) da empresa em runtime.
//
// As constantes de cor em `data.ts` (ROXO, LARANJA, ...) são `var(--brand-*, fallback)`.
// Este componente emite um <style> com `:root { --brand-*: ... }` a partir das cores
// da empresa. Tints são derivados nativamente com color-mix() — o admin só escolhe 3
// cores. Cor ausente => a var não é emitida => cai no fallback da marca Estrela.

import { supabase } from "@/integrations/supabase/client";

export type Branding = {
  cor_primaria?: string | null;
  cor_sidebar?: string | null;
  cor_botao?: string | null;
};

/** URL pública da logo da empresa a partir do path no bucket `logos`. */
export function logoUrl(path?: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("logos").getPublicUrl(path).data.publicUrl ?? null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const ok = (c?: string | null): c is string => !!c && HEX.test(c);

export function brandingVarsCss(b: Branding): string {
  const lines: string[] = [];
  if (ok(b.cor_primaria)) {
    const p = b.cor_primaria;
    lines.push(`--brand-primary:${p}`);
    lines.push(`--brand-primary-dark:color-mix(in srgb, ${p} 70%, black)`);
    lines.push(`--brand-primary-tint:color-mix(in srgb, ${p} 8%, white)`);
    lines.push(`--brand-primary-tint2:color-mix(in srgb, ${p} 16%, white)`);
  }
  if (ok(b.cor_sidebar)) {
    lines.push(`--brand-sidebar:${b.cor_sidebar}`);
  }
  if (ok(b.cor_botao)) {
    lines.push(`--brand-accent:${b.cor_botao}`);
    lines.push(`--brand-accent-tint:color-mix(in srgb, ${b.cor_botao} 10%, white)`);
  }
  return lines.length ? `:root{${lines.join(";")}}` : "";
}

export function BrandingStyle(b: Branding) {
  const css = brandingVarsCss(b);
  if (!css) return null;
  return <style>{css}</style>;
}
