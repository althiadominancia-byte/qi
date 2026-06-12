import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensurePerm(userId: string, perm: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: me } = await supabaseAdmin.from("usuarios").select("id, role, ativo, empresa_id").eq("id", userId).maybeSingle();
  if (!me?.ativo) throw new Error("Usuário não autorizado.");
  if (me.role === "super_admin") return me;
  const { data: perms } = await supabaseAdmin.rpc("user_effective_perms" as any, { _user_id: userId });
  if (!(perms as any)?.[perm]) throw new Error("Permissão negada: " + perm);
  return me;
}

const Item = z.object({
  id: z.string().uuid().optional().nullable(),
  nome: z.string().min(1).max(80),
  ordem: z.number().int().min(0),
  ativo: z.boolean(),
});

const Payload = z.object({
  empresa_id: z.string().uuid(),
  itens: z.array(Item),
  remover: z.array(z.string().uuid()).default([]),
});

export const salvarNiveisLideranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Payload.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me: any = await ensurePerm(userId, "gerenciar_catalogo");
    if (me?.role !== "super_admin" && me?.empresa_id !== data.empresa_id) throw new Error("Empresa fora do escopo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Excluir solicitados (se houver líderes usando o nivel = nome, ainda assim removemos o item — o nome textual permanece no líder)
    if (data.remover.length) {
      const { error } = await supabaseAdmin
        .from("niveis_lideranca")
        .delete()
        .in("id", data.remover)
        .eq("empresa_id", data.empresa_id);
      if (error) throw new Error(error.message);
    }

    // Upserts
    for (const it of data.itens) {
      const row = { empresa_id: data.empresa_id, nome: it.nome.trim(), ordem: it.ordem, ativo: it.ativo };
      if (it.id) {
        const { error } = await supabaseAdmin.from("niveis_lideranca").update(row).eq("id", it.id).eq("empresa_id", data.empresa_id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.from("niveis_lideranca").insert(row as any);
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true };
  });
