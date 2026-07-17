import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { carregarUsuario, type UsuarioAtor } from "@/lib/tenant.server";

// Identidade visual (white-label) por empresa. O controle de acesso é feito aqui
// em TS porque as server functions usam supabaseAdmin (ignora RLS).
//
// Quem pode editar a marca de uma empresa:
//   - super_admin: qualquer empresa;
//   - admin_empresa: apenas a própria (me.empresa_id === empresaId).
function assertPodeEditarBranding(me: UsuarioAtor, empresaId: string) {
  if (me.role === "super_admin") return;
  if (me.role === "admin_empresa" && me.empresa_id === empresaId) return;
  throw new Error("Sem permissão para editar a identidade visual desta empresa.");
}

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB).")
  .nullable();

const BrandingInput = z.object({
  empresaId: z.string().uuid(),
  cor_primaria: hex.optional(),
  cor_sidebar: hex.optional(),
  cor_botao: hex.optional(),
  logo_path: z.string().max(400).nullable().optional(),
});

export const atualizarBrandingEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BrandingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await carregarUsuario(userId);
    assertPodeEditarBranding(me, data.empresaId);

    // Só grava os campos enviados (undefined = não altera).
    const patch: Record<string, string | null> = {};
    if (data.cor_primaria !== undefined) patch.cor_primaria = data.cor_primaria;
    if (data.cor_sidebar !== undefined) patch.cor_sidebar = data.cor_sidebar;
    if (data.cor_botao !== undefined) patch.cor_botao = data.cor_botao;
    if (data.logo_path !== undefined) patch.logo_path = data.logo_path;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("empresas")
      .update(patch as any)
      .eq("id", data.empresaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const GetInput = z.object({ empresaId: z.string().uuid() });

export type EmpresaBranding = {
  logo_path: string | null;
  cor_primaria: string | null;
  cor_sidebar: string | null;
  cor_botao: string | null;
};

export const getBrandingEmpresa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GetInput.parse(d))
  .handler(async ({ data, context }): Promise<EmpresaBranding> => {
    const { userId } = context as any;
    const me = await carregarUsuario(userId);
    assertPodeEditarBranding(me, data.empresaId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: e, error } = await supabaseAdmin
      .from("empresas")
      .select("logo_path, cor_primaria, cor_sidebar, cor_botao")
      .eq("id", data.empresaId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = e as any;
    return {
      logo_path: row?.logo_path ?? null,
      cor_primaria: row?.cor_primaria ?? null,
      cor_sidebar: row?.cor_sidebar ?? null,
      cor_botao: row?.cor_botao ?? null,
    };
  });
