import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, assertEscopo, assertEscopoVaga, assertEscopoLider, carregarUsuario } from "@/lib/tenant.server";

const Area = z.object({
  departamento_id: z.string().uuid(),
  setor_id: z.string().uuid().nullable().optional(),
});

const UpsertLider = z.object({
  empresa_id: z.string().uuid(),
  id: z.string().uuid().optional().nullable(),
  nome: z.string().min(1).max(200),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  telefone: z.string().max(40).optional().nullable().or(z.literal("")),
  nivel: z.string().min(1).max(80),
  ativo: z.boolean().optional().default(true),
  areas: z.array(Area).default([]),
});

export const upsertLider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertLider.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await assertPerm(userId, "gerenciar_catalogo");
    await assertEscopo(me, { empresa_id: data.empresa_id });
    // Se estiver editando, o líder alvo precisa ser da mesma empresa (evita mover líder entre empresas).
    if (data.id) await assertEscopoLider(me, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      empresa_id: data.empresa_id,
      nome: data.nome,
      email: data.email || null,
      telefone: data.telefone || null,
      nivel: data.nivel,
      ativo: data.ativo ?? true,
    };

    let liderId = data.id || null;
    if (liderId) {
      const { error } = await supabaseAdmin.from("lideres").update(payload).eq("id", liderId);
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await supabaseAdmin.from("lideres").insert(payload as any).select("id").maybeSingle();
      if (error || !ins) throw new Error(error?.message || "Falha ao criar líder.");
      liderId = ins.id;
    }

    // Reescreve áreas
    await supabaseAdmin.from("lider_areas").delete().eq("lider_id", liderId);
    if (data.areas.length) {
      const rows = data.areas.map((a) => ({
        empresa_id: data.empresa_id,
        lider_id: liderId!,
        departamento_id: a.departamento_id,
        setor_id: a.setor_id || null,
      }));
      const { error } = await supabaseAdmin.from("lider_areas").insert(rows as any);
      if (error) throw new Error("Falha ao salvar vínculos: " + error.message);
    }
    return { id: liderId };
  });

const DelLider = z.object({ id: z.string().uuid() });
export const excluirLider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DelLider.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await assertPerm(userId, "gerenciar_catalogo");
    await assertEscopoLider(me, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("lideres").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ListBySetor = z.object({ vaga_id: z.string().uuid() });
// Líderes cujo vínculo cobre o setor OU o departamento da vaga
export const listLideresDaVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListBySetor.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await carregarUsuario(userId);
    const vaga = await assertEscopoVaga(me, data.vaga_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!vaga.departamento_id && !vaga.setor_id) return [];

    const { data: areas } = await supabaseAdmin
      .from("lider_areas")
      .select("lider_id, departamento_id, setor_id")
      .eq("empresa_id", vaga.empresa_id);

    const ids = new Set<string>();
    for (const a of areas ?? []) {
      if (a.departamento_id !== vaga.departamento_id) continue;
      // cobre se setor_id é null (departamento inteiro) OU bate com o setor da vaga
      if (!a.setor_id || (vaga.setor_id && a.setor_id === vaga.setor_id)) ids.add(a.lider_id);
    }
    if (!ids.size) return [];
    const { data: lideres } = await supabaseAdmin
      .from("lideres")
      .select("id, nome, nivel, ativo, email, telefone")
      .in("id", Array.from(ids))
      .eq("ativo", true)
      .order("nome");
    return lideres ?? [];
  });
