import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, assertEscopo } from "@/lib/tenant.server";

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
    const me = await assertPerm(userId, "gerenciar_catalogo");
    await assertEscopo(me, { empresa_id: data.empresa_id });
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
