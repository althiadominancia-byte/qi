import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, assertEscopo, carregarUsuario } from "@/lib/tenant.server";

const RoleEditavel = z.enum(["admin_empresa", "recrutador", "visualizador"]);
const PermsSchema = z.record(z.string().min(1).max(64), z.boolean());

// Exige a permissão efetiva `gerenciar_usuarios` E que o alvo seja da mesma empresa.
async function assertManagerOfEmpresa(userId: string, empresaAlvo: string) {
  const me = await assertPerm(userId, "gerenciar_usuarios");
  await assertEscopo(me, { empresa_id: empresaAlvo });
  return me;
}

/* ------------ Padrão por papel ------------ */

const ListInput = z.object({ empresa_id: z.string().uuid() });

export const listPermissoesPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    // controle de acesso: precisa ser super OU pertencer à empresa
    const me = await carregarUsuario(userId);
    await assertEscopo(me, { empresa_id: data.empresa_id });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Garante linhas-padrão se ainda não existirem (idempotente)
    const roles = ["admin_empresa", "recrutador", "visualizador"] as const;
    for (const role of roles) {
      const { data: ex } = await supabaseAdmin
        .from("permissoes_papel").select("role").eq("empresa_id", data.empresa_id).eq("role", role).maybeSingle();
      if (!ex) {
        const { data: preset } = await supabaseAdmin.rpc("preset_perms", { _role: role });
        await supabaseAdmin.from("permissoes_papel").insert({ empresa_id: data.empresa_id, role, perms: preset ?? {} });
      }
    }
    const { data: rows, error } = await supabaseAdmin
      .from("permissoes_papel").select("role, perms, updated_at").eq("empresa_id", data.empresa_id);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SavePapelInput = z.object({
  empresa_id: z.string().uuid(),
  role: RoleEditavel,
  perms: PermsSchema,
});

export const savePermissoesPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SavePapelInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertManagerOfEmpresa(userId, data.empresa_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("permissoes_papel").upsert({
      empresa_id: data.empresa_id, role: data.role, perms: data.perms,
    }, { onConflict: "empresa_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------ Usuários da empresa + override ------------ */

export const listUsuariosDaEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await carregarUsuario(userId);
    await assertEscopo(me, { empresa_id: data.empresa_id });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("usuarios")
      .select("id, nome, email, role, perms, ativo")
      .eq("empresa_id", data.empresa_id)
      .neq("role", "super_admin")
      .order("nome");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SaveOverrideInput = z.object({
  user_id: z.string().uuid(),
  perms: PermsSchema, // override esparso (apenas chaves que divergem do padrão)
});

export const saveUserOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveOverrideInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: alvo } = await supabaseAdmin
      .from("usuarios").select("empresa_id, role").eq("id", data.user_id).maybeSingle();
    if (!alvo) throw new Error("Usuário não encontrado.");
    if (alvo.role === "super_admin") throw new Error("Não é possível ajustar permissões de Super Admin.");
    if (!alvo.empresa_id) throw new Error("Usuário sem empresa.");
    await assertManagerOfEmpresa(userId, alvo.empresa_id);
    const { error } = await supabaseAdmin.from("usuarios").update({ perms: data.perms }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ResetInput = z.object({ user_id: z.string().uuid() });

export const resetUserOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResetInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: alvo } = await supabaseAdmin
      .from("usuarios").select("empresa_id, role").eq("id", data.user_id).maybeSingle();
    if (!alvo) throw new Error("Usuário não encontrado.");
    if (alvo.role === "super_admin") throw new Error("Não é possível ajustar permissões de Super Admin.");
    if (!alvo.empresa_id) throw new Error("Usuário sem empresa.");
    await assertManagerOfEmpresa(userId, alvo.empresa_id);
    const { error } = await supabaseAdmin.from("usuarios").update({ perms: {} }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
