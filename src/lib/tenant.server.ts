// Helper central de multi-tenancy (server-only).
//
// Todas as server functions usam `supabaseAdmin`, que IGNORA o RLS. Logo, o
// isolamento entre empresas precisa ser garantido AQUI, na aplicação. Este
// módulo consolida o padrão antes espalhado (ensurePerm/assertManagerOfEmpresa).
//
// IMPORTANTE: o helper SQL `user_can_access_unidade` usa `auth.uid()`, que é
// nulo quando chamado via service role — por isso o escopo é resolvido aqui em
// TS, lendo `usuarios` + `usuario_unidades` diretamente.

import type { Database } from "@/integrations/supabase/types";

export type Role = Database["public"]["Enums"]["user_role"];

export type UsuarioAtor = {
  id: string;
  role: Role;
  empresa_id: string | null;
  todas_unidades: boolean;
  ativo: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Carrega o usuário logado; lança se inexistente ou inativo. */
export async function carregarUsuario(userId: string): Promise<UsuarioAtor> {
  const supabaseAdmin = await admin();
  const { data: me } = await supabaseAdmin
    .from("usuarios")
    .select("id, role, empresa_id, todas_unidades, ativo")
    .eq("id", userId)
    .maybeSingle();
  if (!me || !me.ativo) throw new Error("Usuário não autorizado.");
  return me as UsuarioAtor;
}

/** Garante a permissão efetiva. super_admin sempre passa. Retorna o ator. */
export async function assertPerm(userId: string, perm: string): Promise<UsuarioAtor> {
  const me = await carregarUsuario(userId);
  if (me.role === "super_admin") return me;
  const supabaseAdmin = await admin();
  const { data: perms } = await supabaseAdmin.rpc("user_effective_perms" as any, { _user_id: userId });
  if (!(perms as any)?.[perm]) throw new Error("Permissão negada: " + perm);
  return me;
}

/** IDs das unidades liberadas para o usuário (via usuario_unidades). */
export async function unidadesDoUsuario(userId: string): Promise<string[]> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin.from("usuario_unidades").select("unidade_id").eq("usuario_id", userId);
  return (data ?? []).map((x: any) => x.unidade_id as string);
}

/**
 * Valida se o ator pode acessar um recurso de (empresa_id, unidade_id).
 * super_admin passa; senão exige mesma empresa E (todas_unidades OU unidade liberada).
 * unidade_id ausente ⇒ basta a empresa (recurso sem unidade específica).
 */
export async function assertEscopo(
  me: UsuarioAtor,
  recurso: { empresa_id: string | null; unidade_id?: string | null },
): Promise<void> {
  if (me.role === "super_admin") return;
  if (!recurso.empresa_id || me.empresa_id !== recurso.empresa_id) {
    throw new Error("Recurso fora do seu escopo.");
  }
  if (me.todas_unidades) return;
  if (!recurso.unidade_id) return;
  const unidades = await unidadesDoUsuario(me.id);
  if (!unidades.includes(recurso.unidade_id)) {
    throw new Error("Unidade fora do seu escopo.");
  }
}

/* ------------ Loaders com validação de escopo ------------ */
// Cada loader busca o recurso já com empresa_id/unidade_id, valida o escopo e
// RETORNA o registro — evitando uma segunda consulta no chamador.

export async function assertEscopoVaga(me: UsuarioAtor, vagaId: string) {
  const supabaseAdmin = await admin();
  const { data: vaga } = await supabaseAdmin
    .from("vagas")
    .select("id, empresa_id, unidade_id, status, encerrada_em, departamento_id, setor_id")
    .eq("id", vagaId)
    .maybeSingle();
  if (!vaga) throw new Error("Vaga não encontrada.");
  await assertEscopo(me, vaga);
  return vaga;
}

export async function assertEscopoCandidato(me: UsuarioAtor, candidatoId: string) {
  const supabaseAdmin = await admin();
  const { data: cand } = await supabaseAdmin
    .from("candidatos_televendas")
    .select("id, empresa_id, unidade_id, vaga_id, etapa, nome, email, celular, cv_storage_path")
    .eq("id", candidatoId)
    .maybeSingle();
  if (!cand) throw new Error("Candidato não encontrado.");
  // empresa_id/unidade_id do candidato podem ser nulos (colunas preenchidas por
  // trigger); nesse caso, deriva o escopo da vaga vinculada.
  let empresa_id = cand.empresa_id;
  let unidade_id = cand.unidade_id;
  if (!empresa_id && cand.vaga_id) {
    const { data: vaga } = await supabaseAdmin
      .from("vagas").select("empresa_id, unidade_id").eq("id", cand.vaga_id).maybeSingle();
    empresa_id = vaga?.empresa_id ?? null;
    unidade_id = vaga?.unidade_id ?? null;
  }
  await assertEscopo(me, { empresa_id, unidade_id });
  return cand;
}

export async function assertEscopoLider(me: UsuarioAtor, liderId: string) {
  const supabaseAdmin = await admin();
  const { data: lider } = await supabaseAdmin
    .from("lideres")
    .select("id, empresa_id, nome, nivel, ativo")
    .eq("id", liderId)
    .maybeSingle();
  if (!lider) throw new Error("Líder não encontrado.");
  await assertEscopo(me, { empresa_id: lider.empresa_id });
  return lider;
}

export async function assertEscopoContratacao(me: UsuarioAtor, contratacaoId: string) {
  const supabaseAdmin = await admin();
  const { data: contr } = await supabaseAdmin
    .from("contratacoes")
    .select("id, empresa_id, unidade_id, vaga_id, candidato_id, lider_id")
    .eq("id", contratacaoId)
    .maybeSingle();
  if (!contr) throw new Error("Contratação não encontrada.");
  await assertEscopo(me, contr);
  return contr;
}

export async function assertEscopoAvaliacao(me: UsuarioAtor, avaliacaoId: string) {
  const supabaseAdmin = await admin();
  const { data: av } = await supabaseAdmin
    .from("avaliacoes_experiencia")
    .select("id, empresa_id, unidade_id, contratacao_id, status")
    .eq("id", avaliacaoId)
    .maybeSingle();
  if (!av) throw new Error("Avaliação não encontrada.");
  await assertEscopo(me, av);
  return av;
}
