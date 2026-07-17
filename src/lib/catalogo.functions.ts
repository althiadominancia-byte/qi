import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, assertEscopo } from "@/lib/tenant.server";

const SetorIn = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(120),
  ativo: z.boolean().default(true),
  ordem: z.number().int().default(0),
});
const DepIn = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(120),
  ativo: z.boolean().default(true),
  ordem: z.number().int().default(0),
  setores: z.array(SetorIn).default([]),
});
const SaveInput = z.object({
  empresa_id: z.string().uuid(),
  departamentos: z.array(DepIn),
});

// Valida permissão efetiva (preset do papel + override) E escopo de empresa.
async function assertCanManage(userId: string, empresaId: string) {
  const me = await assertPerm(userId, "gerenciar_vagas");
  await assertEscopo(me, { empresa_id: empresaId });
}

export const saveCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertCanManage(userId, data.empresa_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: depsExist } = await supabaseAdmin.from("departamentos").select("id").eq("empresa_id", data.empresa_id);
    const existDepIds = new Set((depsExist ?? []).map((d: any) => d.id));
    const keepDepIds = new Set(data.departamentos.filter((d) => d.id).map((d) => d.id!));

    // Persistir departamentos
    const depIdMap = new Map<string, string>(); // local key → real id
    for (let i = 0; i < data.departamentos.length; i++) {
      const d = data.departamentos[i];
      const payload = { empresa_id: data.empresa_id, nome: d.nome.trim(), ativo: d.ativo, ordem: i };
      if (d.id && existDepIds.has(d.id)) {
        const { error } = await supabaseAdmin.from("departamentos").update(payload).eq("id", d.id);
        if (error) throw new Error("Departamento: " + error.message);
        depIdMap.set(d.id, d.id);
      } else {
        const { data: ins, error } = await supabaseAdmin.from("departamentos").insert(payload).select("id").single();
        if (error) throw new Error("Departamento: " + error.message);
        depIdMap.set(d.id ?? `new-${i}`, ins.id);
      }
    }

    // Apagar departamentos removidos (e seus setores; CASCADE FK setores → departamentos cuida)
    // Só apagar se não houver vagas vinculadas; senão, inativar.
    for (const ex of existDepIds) {
      if (!keepDepIds.has(ex)) {
        const { count } = await supabaseAdmin.from("vagas").select("id", { count: "exact", head: true }).eq("departamento_id", ex);
        if ((count ?? 0) > 0) {
          await supabaseAdmin.from("departamentos").update({ ativo: false }).eq("id", ex);
        } else {
          await supabaseAdmin.from("departamentos").delete().eq("id", ex);
        }
      }
    }

    // Setores por departamento
    for (let i = 0; i < data.departamentos.length; i++) {
      const d = data.departamentos[i];
      const realDepId = depIdMap.get(d.id ?? `new-${i}`)!;
      const { data: setsExist } = await supabaseAdmin.from("setores").select("id").eq("departamento_id", realDepId);
      const existSetIds = new Set((setsExist ?? []).map((s: any) => s.id));
      const keepSetIds = new Set(d.setores.filter((s) => s.id).map((s) => s.id!));

      for (let j = 0; j < d.setores.length; j++) {
        const s = d.setores[j];
        const payload = { empresa_id: data.empresa_id, departamento_id: realDepId, nome: s.nome.trim(), ativo: s.ativo, ordem: j };
        if (s.id && existSetIds.has(s.id)) {
          const { error } = await supabaseAdmin.from("setores").update(payload).eq("id", s.id);
          if (error) throw new Error("Setor: " + error.message);
        } else {
          const { error } = await supabaseAdmin.from("setores").insert(payload);
          if (error) throw new Error("Setor: " + error.message);
        }
      }
      for (const ex of existSetIds) {
        if (!keepSetIds.has(ex)) {
          const { count } = await supabaseAdmin.from("vagas").select("id", { count: "exact", head: true }).eq("setor_id", ex);
          if ((count ?? 0) > 0) {
            await supabaseAdmin.from("setores").update({ ativo: false }).eq("id", ex);
          } else {
            await supabaseAdmin.from("setores").delete().eq("id", ex);
          }
        }
      }
    }
    return { ok: true };
  });

const SeedInput = z.object({ empresa_id: z.string().uuid() });
const PADRAO = [
  { nome: "Comercial", setores: ["Televendas", "Vendas externas", "SAC / Pós-venda"] },
  { nome: "Logística", setores: ["Estoque", "Expedição", "Recebimento"] },
  { nome: "Administrativo", setores: ["Financeiro", "RH / DP", "Compras"] },
];

export const seedCatalogoPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SeedInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertCanManage(userId, data.empresa_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < PADRAO.length; i++) {
      const dep = PADRAO[i];
      const { data: existing } = await supabaseAdmin
        .from("departamentos").select("id").eq("empresa_id", data.empresa_id).ilike("nome", dep.nome).maybeSingle();
      let depId = existing?.id;
      if (!depId) {
        const { data: ins, error } = await supabaseAdmin.from("departamentos")
          .insert({ empresa_id: data.empresa_id, nome: dep.nome, ordem: i }).select("id").single();
        if (error) throw new Error(error.message);
        depId = ins.id;
      }
      for (let j = 0; j < dep.setores.length; j++) {
        const n = dep.setores[j];
        const { data: sx } = await supabaseAdmin
          .from("setores").select("id").eq("departamento_id", depId).ilike("nome", n).maybeSingle();
        if (!sx) {
          await supabaseAdmin.from("setores").insert({ empresa_id: data.empresa_id, departamento_id: depId, nome: n, ordem: j });
        }
      }
    }
    return { ok: true };
  });
