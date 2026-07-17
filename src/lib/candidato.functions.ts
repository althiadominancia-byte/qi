import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, carregarUsuario, assertEscopoCandidato } from "@/lib/tenant.server";

const Input = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1).max(200),
  email: z.string().email().max(200),
  celular: z.string().min(1).max(40),
  endereco: z.string().max(500).optional().nullable(),
  setor_atual: z.string().max(200).optional().nullable(),
  tempo_empresa: z.string().max(100).optional().nullable(),
});

export const atualizarCadastroCandidato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await assertPerm(userId, "gerenciar_vagas");
    await assertEscopoCandidato(me, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("candidatos_televendas").update({
      nome: data.nome,
      email: data.email,
      celular: data.celular,
      endereco: data.endereco || null,
      setor_atual: data.setor_atual || null,
      tempo_empresa: data.tempo_empresa || null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DelInput = z.object({ id: z.string().uuid() });
export const excluirCandidato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DelInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const me = await carregarUsuario(userId);
    if (me.role !== "super_admin") {
      throw new Error("Apenas super admin pode excluir candidatos.");
    }
    // Valida existência (assertEscopo é no-op para super_admin, mas confirma o registro).
    await assertEscopoCandidato(me, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("candidatos_televendas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
