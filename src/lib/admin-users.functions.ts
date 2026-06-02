import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum(["super_admin", "admin_empresa", "recrutador", "visualizador"]);
const PermsSchema = z.record(z.string(), z.boolean());

const CreateInput = z.object({
  nome: z.string().min(1).max(120),
  email: z.string().email().max(200),
  role: RoleEnum,
  empresa_id: z.string().uuid().nullable(),
  todas_unidades: z.boolean(),
  unidades: z.array(z.string().uuid()).default([]),
  perms: PermsSchema,
  ativo: z.boolean().default(true),
});

const UpdateInput = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1).max(120),
  role: RoleEnum,
  empresa_id: z.string().uuid().nullable(),
  todas_unidades: z.boolean(),
  unidades: z.array(z.string().uuid()).default([]),
  perms: PermsSchema,
  ativo: z.boolean(),
});

async function assertCanManage(userId: string, alvoEmpresa: string | null, alvoRole: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: me } = await supabaseAdmin
    .from("usuarios").select("role, empresa_id, perms, ativo").eq("id", userId).maybeSingle();
  if (!me || !me.ativo) throw new Error("Usuário não autorizado.");
  if (me.role === "super_admin") return { isSuper: true, me };
  if (!me.perms || !(me.perms as any).gerenciar_usuarios) throw new Error("Sem permissão para gerenciar usuários.");
  if (alvoRole === "super_admin") throw new Error("Apenas super admin pode criar super admin.");
  if (alvoEmpresa !== me.empresa_id) throw new Error("Você só pode gerenciar usuários da sua própria empresa.");
  return { isSuper: false, me };
}

export const createUserInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertCanManage(userId, data.empresa_id, data.role);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const origin = process.env.SITE_URL || process.env.SUPABASE_URL || "";
    const redirectTo = origin ? new URL("/auth", origin).toString() : undefined;

    const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { data: { name: data.nome }, redirectTo },
    );
    if (invErr || !invited?.user) {
      if (invErr?.message?.toLowerCase().includes("already")) {
        const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
        const found = existing?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
        if (!found) throw new Error(invErr?.message || "Falha ao convidar");
        const newId = found.id;
        await upsertUsuario(newId, data);
        return { ok: true, id: newId, reused: true };
      }
      throw new Error(invErr?.message || "Falha ao convidar usuário");
    }
    await upsertUsuario(invited.user.id, data);
    return { ok: true, id: invited.user.id, reused: false };
  });

async function upsertUsuario(id: string, d: z.infer<typeof CreateInput>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: e1 } = await supabaseAdmin.from("usuarios").upsert({
    id, nome: d.nome, email: d.email, role: d.role,
    empresa_id: d.role === "super_admin" ? null : d.empresa_id,
    todas_unidades: d.todas_unidades, perms: d.perms, ativo: d.ativo,
  });
  if (e1) throw new Error(e1.message);
  await supabaseAdmin.from("usuario_unidades").delete().eq("usuario_id", id);
  if (!d.todas_unidades && d.unidades.length) {
    const rows = d.unidades.map((u) => ({ usuario_id: id, unidade_id: u }));
    const { error: e2 } = await supabaseAdmin.from("usuario_unidades").insert(rows);
    if (e2) throw new Error(e2.message);
  }
}

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertCanManage(userId, data.empresa_id, data.role);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("usuarios").update({
      nome: data.nome, role: data.role,
      empresa_id: data.role === "super_admin" ? null : data.empresa_id,
      todas_unidades: data.todas_unidades, perms: data.perms, ativo: data.ativo,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("usuario_unidades").delete().eq("usuario_id", data.id);
    if (!data.todas_unidades && data.unidades.length) {
      const rows = data.unidades.map((u) => ({ usuario_id: data.id, unidade_id: u }));
      const { error: e2 } = await supabaseAdmin.from("usuario_unidades").insert(rows);
      if (e2) throw new Error(e2.message);
    }
    return { ok: true };
  });

const ToggleInput = z.object({ id: z.string().uuid(), ativo: z.boolean() });
export const toggleUserAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ToggleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: alvo } = await supabaseAdmin.from("usuarios").select("empresa_id, role").eq("id", data.id).maybeSingle();
    if (!alvo) throw new Error("Usuário não encontrado");
    await assertCanManage(userId, alvo.empresa_id, alvo.role);
    const { error } = await supabaseAdmin.from("usuarios").update({ ativo: data.ativo }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
