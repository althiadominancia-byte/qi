import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ScopeBranding = {
  logo_path: string | null;
  cor_primaria: string | null;
  cor_sidebar: string | null;
  cor_botao: string | null;
};

export type UserScope = {
  id: string;
  nome: string;
  email: string;
  role: "super_admin" | "admin_empresa" | "recrutador" | "visualizador";
  empresa_id: string | null;
  empresa_nome: string | null;
  empresa_ativa: boolean;
  todas_unidades: boolean;
  unidades_permitidas: string[];
  perms: Record<string, boolean>; // permissões EFETIVAS (padrão do papel + overrides)
  ativo: boolean;
  branding: ScopeBranding | null; // identidade visual (white-label) da empresa
};

export const getMyScope = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: u, error } = await supabase
      .from("usuarios")
      .select("id, nome, email, role, empresa_id, todas_unidades, ativo")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!u) {
      return {
        id: userId, nome: "", email: "", role: "visualizador",
        empresa_id: null, empresa_nome: null, empresa_ativa: false,
        todas_unidades: false, unidades_permitidas: [], perms: {}, ativo: false,
        branding: null,
      } as UserScope;
    }
    let empresa_nome: string | null = null;
    let empresa_ativa = true;
    let branding: UserScope["branding"] = null;
    if (u.empresa_id) {
      const { data: e } = await supabase
        .from("empresas")
        .select("nome, ativo, logo_path, cor_primaria, cor_sidebar, cor_botao")
        .eq("id", u.empresa_id)
        .maybeSingle();
      empresa_nome = e?.nome ?? null;
      empresa_ativa = e?.ativo ?? false;
      if (e) {
        branding = {
          logo_path: (e as any).logo_path ?? null,
          cor_primaria: (e as any).cor_primaria ?? null,
          cor_sidebar: (e as any).cor_sidebar ?? null,
          cor_botao: (e as any).cor_botao ?? null,
        };
      }
    }
    const { data: uu } = await supabase.from("usuario_unidades").select("unidade_id").eq("usuario_id", userId);
    const { data: eff } = await supabase.rpc("user_effective_perms", { _user_id: userId });
    return {
      id: u.id, nome: u.nome, email: u.email, role: u.role,
      empresa_id: u.empresa_id, empresa_nome, empresa_ativa,
      todas_unidades: u.todas_unidades,
      unidades_permitidas: (uu ?? []).map((x: any) => x.unidade_id),
      perms: (eff ?? {}) as Record<string, boolean>,
      ativo: u.ativo,
      branding,
    } as UserScope;
  });
