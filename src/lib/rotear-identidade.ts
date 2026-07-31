import { supabase } from "@/integrations/supabase/client";

export type DestinoIdentidade = "/super" | "/admin" | "/portal" | "/auth";

/**
 * Decide o destino pós-login pela identidade do auth-user (cliente browser, RLS):
 * 1. Sem sessão → /auth.
 * 2. Staff VENCE: linha em `usuarios` → super_admin vai a /super, demais papéis a /admin.
 * 3. Conta de candidato em `candidato_contas` (policy select-own) → /portal.
 * 4. Auth-user órfão (sem linha em nenhuma das duas) → /auth.
 */
export async function destinoPorIdentidade(): Promise<DestinoIdentidade> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return "/auth";
  const userId = data.user.id;

  const { data: u } = await supabase
    .from("usuarios")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (u) return u.role === "super_admin" ? "/super" : "/admin";

  // candidato_contas ainda não existe em types.ts (gerado) — cast necessário.
  const { data: conta } = await (supabase as any)
    .from("candidato_contas")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (conta) return "/portal";

  return "/auth";
}
