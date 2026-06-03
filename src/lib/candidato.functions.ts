import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1).max(200),
  email: z.string().email().max(200),
  celular: z.string().min(1).max(40),
  endereco: z.string().max(500).optional().nullable(),
  setor_atual: z.string().max(200).optional().nullable(),
  tempo_empresa: z.string().max(100).optional().nullable(),
});

async function ensurePerm(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: me } = await supabaseAdmin.from("usuarios").select("id, role, ativo").eq("id", userId).maybeSingle();
  if (!me?.ativo) throw new Error("Usuário não autorizado.");
  if (me.role === "super_admin") return;
  const { data: perms } = await supabaseAdmin.rpc("user_effective_perms" as any, { _user_id: userId });
  if (!(perms as any)?.gerenciar_vagas) throw new Error("Sem permissão para editar dados do candidato.");
}

export const atualizarCadastroCandidato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await ensurePerm(userId);
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
