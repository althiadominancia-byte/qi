// Helpers do PORTAL DO CANDIDATO (server-only).
//
// O portal usa `supabaseAdmin`, que IGNORA o RLS — o isolamento aqui é por
// TITULARIDADE: cada operação exige que a candidatura pertença à conta do
// candidato logado (candidatos_televendas.conta_id = candidato_contas.id).
// Tudo neste módulo é FAIL-CLOSED: na dúvida, nega.
//
// IMPORTANTE: nunca retornar às fns do portal campos internos do processo
// (match_final, cv_analise, disc_*, situacionais, decisao_*, etc.) — os
// SELECTs usam allowlist explícita, nunca `*`.

export type CandidatoConta = {
  id: string;
  email: string;
  nome: string | null;
  versao_termo: string | null;
};

export type CandidaturaPossuida = {
  id: string;
  conta_id: string | null;
  empresa_id: string | null;
  vaga_id: string | null;
  cv_storage_path: string | null;
  nome: string | null;
  email: string | null;
  celular: string | null;
  endereco: string | null;
  setor_atual: string | null;
  tempo_empresa: string | null;
  etapa: string | null;
  entrevista_data: string | null;
  created_at: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Carrega a conta do candidato logado; lança se não existir. */
export async function carregarConta(userId: string): Promise<CandidatoConta> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("candidato_contas")
    .select("id, email, nome, versao_termo")
    .eq("id", userId)
    .maybeSingle();
  if (!data) throw new Error("Conta de candidato não encontrada.");
  return data as CandidatoConta;
}

/**
 * Garante que a candidatura pertence à conta (titularidade). Retorna o
 * registro já com as colunas permitidas ao portal (allowlist — NUNCA `*`).
 *
 * PROIBIDO acrescentar a este select (vazariam ao titular dados internos do
 * processo): match_final, match_label, cv_analise, disc_respostas,
 * disc_pontuacao, situacionais, postura_score, perfil_key, perfil_nome,
 * nao_contratado_motivo, entrevista_obs.
 */
export async function assertDonoCandidatura(
  conta: CandidatoConta,
  candidatoId: string,
): Promise<CandidaturaPossuida> {
  const supabaseAdmin = await admin();
  const { data: cand } = await supabaseAdmin
    .from("candidatos_televendas")
    .select(
      "id, conta_id, empresa_id, vaga_id, cv_storage_path, nome, email, celular, endereco, setor_atual, tempo_empresa, etapa, entrevista_data, created_at",
    )
    .eq("id", candidatoId)
    .maybeSingle();
  if (!cand) throw new Error("Candidatura não encontrada.");
  if ((cand as any).conta_id !== conta.id) {
    throw new Error("Esta candidatura não pertence à sua conta.");
  }
  return cand as CandidaturaPossuida;
}

/**
 * Empresa dona da candidatura. empresa_id pode ser nulo (coluna preenchida por
 * trigger) — nesse caso deriva da vaga vinculada (mesmo fallback de
 * assertEscopoCandidato em tenant.server.ts).
 */
export async function resolverEmpresaDaCandidatura(cand: {
  empresa_id: string | null;
  vaga_id: string | null;
}): Promise<string | null> {
  if (cand.empresa_id) return cand.empresa_id;
  if (!cand.vaga_id) return null;
  const supabaseAdmin = await admin();
  const { data: vaga } = await supabaseAdmin
    .from("vagas")
    .select("empresa_id")
    .eq("id", cand.vaga_id)
    .maybeSingle();
  return (vaga as any)?.empresa_id ?? null;
}

/**
 * Entitlement `portal_candidato` da empresa. FAIL-CLOSED: diferente das
 * features legadas (permissivas), o portal só liga com `true` EXPLÍCITO no
 * merge plano.features + override da empresa (mesma consulta de
 * empresaFeatures em tenant.server.ts). Empresa desconhecida/nula ⇒ false.
 */
export async function portalHabilitado(empresaId: string | null): Promise<boolean> {
  if (!empresaId) return false;
  const supabaseAdmin = await admin();
  const { data: e } = await supabaseAdmin
    .from("empresas")
    .select("plano_id, features")
    .eq("id", empresaId)
    .maybeSingle();
  if (!e) return false;
  let planoFeatures: Record<string, boolean> | null = null;
  const planoId = (e as any)?.plano_id ?? null;
  if (planoId) {
    const { data: p } = await supabaseAdmin
      .from("planos")
      .select("features")
      .eq("id", planoId)
      .maybeSingle();
    planoFeatures = ((p as any)?.features ?? null) as Record<string, boolean> | null;
  }
  const override = ((e as any)?.features ?? null) as Record<string, boolean> | null;
  const merged: Record<string, boolean> = { ...(planoFeatures ?? {}), ...(override ?? {}) };
  return merged["portal_candidato"] === true;
}

/**
 * Trava de segurança da reivindicação por e-mail: se o projeto Supabase
 * estiver com autoconfirmação de e-mail ligada, QUALQUER um poderia criar uma
 * conta com o e-mail de um candidato sem prová-lo. FAIL-CLOSED: falha de
 * rede/parse também bloqueia.
 */
export async function assertAuthSettingsSeguras(): Promise<void> {
  // process.env SEMPRE dentro da função (Cloudflare vincula o env por requisição).
  const url = process.env.SUPABASE_URL;
  const apikey = process.env.SUPABASE_PUBLISHABLE_KEY;
  // Dois bloqueios FAIL-CLOSED com mensagens distintas: falha transitória
  // (rede/parse) pede "tente de novo"; config insegura de verdade explica o
  // motivo. Misturar os dois confundia o candidato (visto no teste E2E).
  const bloqueioTransitorio = new Error(
    "Não foi possível validar a segurança do projeto agora. Tente novamente em instantes.",
  );
  const bloqueioConfig = new Error(
    "Confirmação de e-mail desligada no projeto — reivindicação bloqueada por segurança.",
  );
  if (!url || !apikey) throw bloqueioTransitorio;
  let json: any = null;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey } });
    if (!res.ok) throw bloqueioTransitorio;
    json = await res.json();
  } catch {
    throw bloqueioTransitorio;
  }
  // FAIL-CLOSED de verdade: exige a chave presente E explicitamente false.
  // (`=== true` deixaria passar um payload sem a chave — auditoria pegou.)
  if (!json || json.mailer_autoconfirm !== false) throw bloqueioConfig;
}

/** E-mail VERIFICADO do usuário logado (lança se ainda não confirmado). */
export async function emailVerificadoDoUsuario(userId: string): Promise<string> {
  const supabaseAdmin = await admin();
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user?.email) throw new Error("Usuário não encontrado.");
  if (!user.email_confirmed_at) {
    throw new Error("Confirme seu e-mail antes de continuar.");
  }
  return String(user.email).trim().toLowerCase();
}

/**
 * Trilha de auditoria das alterações feitas pelo TITULAR no portal.
 * Best-effort: falha aqui não pode derrubar a operação principal.
 */
export async function registrarAlteracao(
  candidatoId: string,
  empresaId: string | null,
  campo: string,
  valorAnterior: string | null,
  valorNovo: string | null,
): Promise<void> {
  try {
    const supabaseAdmin = await admin();
    const { error } = await supabaseAdmin.from("candidato_alteracoes").insert({
      candidato_id: candidatoId,
      empresa_id: empresaId,
      campo,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
      autor: "titular",
    });
    // Mensagem genérica de propósito: não vazar detalhes do banco em logs.
    if (error) console.error("[portal] auditoria: registro de alteração falhou");
  } catch {
    console.error("[portal] auditoria: registro de alteração falhou");
  }
}
