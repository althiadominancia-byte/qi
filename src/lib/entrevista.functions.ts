import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, assertEscopoCandidato, empresaFeatures } from "@/lib/tenant.server";

// Módulo de entrevista por vídeo com IA — camada de acesso.
// A sala LiveKit e a análise ficam para as fases seguintes; aqui já garantimos
// a estrutura de acesso CORRETA: permissão conduzir_entrevistas + escopo do
// candidato (tenant) + entitlement entrevista_ia da empresa.

const CandId = z.object({ candidatoId: z.string().uuid() });

// Emite um access token do LiveKit (server-only: usa API key/secret). Import
// dinâmico para não ir ao bundle do cliente.
async function mintLivekitToken(room: string, identity: string, nome: string) {
  const url = process.env.LIVEKIT_URL, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) throw new Error("LiveKit não configurado (LIVEKIT_URL/API_KEY/API_SECRET).");
  const { AccessToken } = await import("livekit-server-sdk");
  const at = new AccessToken(key, secret, { identity, name: nome, ttl: "2h" });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();
  return { url, token, room };
}

/** Token da sala para o RECRUTADOR. Acesso: conduzir_entrevistas + escopo + entitlement. */
export const emitirTokenSala = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ entrevista_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "conduzir_entrevistas");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: ent } = await admin.from("entrevistas")
      .select("id, candidato_id, empresa_id, livekit_room, status").eq("id", data.entrevista_id).maybeSingle();
    if (!ent) throw new Error("Entrevista não encontrada.");
    await assertEscopoCandidato(me, ent.candidato_id);
    const feats = await empresaFeatures(ent.empresa_id ?? null);
    if (!feats.entrevista_ia) throw new Error("O plano desta empresa não inclui entrevista por vídeo com IA.");
    const room = ent.livekit_room || `entrevista-${ent.id}`;
    if (!ent.livekit_room || ent.status === "agendada") {
      await admin.from("entrevistas").update({ livekit_room: room, status: "em_andamento" }).eq("id", ent.id);
    }
    return mintLivekitToken(room, `rec-${(context as any).userId}`, "Recrutador");
  });

/** Token da sala para o CANDIDATO (público, por token). Exige consentimento aceito. */
export const emitirTokenSalaCandidato = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(6).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: ent } = await admin.from("entrevistas")
      .select("id, livekit_room, candidato:candidatos_televendas(nome)").eq("token", data.token).maybeSingle();
    if (!ent) throw new Error("Entrevista não encontrada.");
    const { data: cons } = await admin.from("entrevista_consentimentos")
      .select("consentiu").eq("entrevista_id", ent.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!cons?.consentiu) throw new Error("É preciso aceitar o termo de consentimento antes de entrar na sala.");
    const room = ent.livekit_room || `entrevista-${ent.id}`;
    if (!ent.livekit_room) await admin.from("entrevistas").update({ livekit_room: room }).eq("id", ent.id);
    return mintLivekitToken(room, `cand-${ent.id}`, ent.candidato?.nome || "Candidato");
  });

/**
 * Cria (ou reutiliza) a entrevista do candidato. Gera o token do link público.
 * Acesso: conduzir_entrevistas + escopo do candidato + entitlement entrevista_ia.
 */
export const agendarEntrevista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "conduzir_entrevistas");
    const cand = await assertEscopoCandidato(me, data.candidatoId);
    const feats = await empresaFeatures((cand as any).empresa_id ?? null);
    if (!feats.entrevista_ia) throw new Error("O plano desta empresa não inclui entrevista por vídeo com IA.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    // Reutiliza uma entrevista ainda ativa se já houver.
    const { data: existente } = await admin.from("entrevistas")
      .select("id, token, status").eq("candidato_id", data.candidatoId).neq("status", "cancelada")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existente) return { id: existente.id, token: existente.token, status: existente.status, reused: true };

    const { data: nova, error } = await admin.from("entrevistas")
      .insert({ candidato_id: data.candidatoId, criado_por: (context as any).userId, status: "agendada" })
      .select("id, token, status").maybeSingle();
    if (error || !nova) throw new Error(error?.message ?? "Falha ao criar a entrevista.");
    return { id: nova.id, token: nova.token, status: nova.status, reused: false };
  });

/** Entrevista atual do candidato (para a UI do recrutador). Acesso idêntico. */
export const getEntrevistaDoCandidato = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "conduzir_entrevistas");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: e } = await admin.from("entrevistas")
      .select("id, token, status, agendada_para, decisao_humana, decisao_em")
      .eq("candidato_id", data.candidatoId).neq("status", "cancelada")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!e) return null;
    const { data: cons } = await admin.from("entrevista_consentimentos")
      .select("consentiu, created_at").eq("entrevista_id", e.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { ...e, consentimento: cons ?? null };
  });

// ===== Consentimento LGPD do candidato (público — autenticado pelo token) =====
const Consent = z.object({
  token: z.string().min(6).max(200),
  consentiu: z.boolean(),
  versao_termo: z.string().max(20),
});
/**
 * Registra o consentimento (ou recusa) do candidato para gravação/IA. Público:
 * o token da entrevista é a credencial. Se recusar, a entrevista segue SEM
 * gravação/IA (fallback), para o consentimento ser livre (sem penalização).
 */
export const registrarConsentimento = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Consent.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: ent } = await admin.from("entrevistas")
      .select("id, candidato_id, status").eq("token", data.token).maybeSingle();
    if (!ent) throw new Error("Entrevista não encontrada.");
    const { error } = await admin.from("entrevista_consentimentos").insert({
      entrevista_id: ent.id, candidato_id: ent.candidato_id,
      consentiu: data.consentiu, versao_termo: data.versao_termo,
    });
    if (error) throw new Error(error.message);
    // Recusa => segue sem gravação/IA (consentimento livre, sem penalização).
    if (!data.consentiu && ent.status === "agendada") {
      await admin.from("entrevistas").update({ status: "sem_gravacao" }).eq("id", ent.id);
    }
    return { ok: true, consentiu: data.consentiu };
  });

const Decisao = z.object({
  candidatoId: z.string().uuid(),
  entrevista_id: z.string().uuid(),
  decisao: z.enum(["avancar", "reprovar"]),
});
/** Registra a decisão HUMANA sobre a entrevista (nunca automática). */
export const registrarDecisaoEntrevista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Decisao.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertPerm((context as any).userId, "conduzir_entrevistas");
    await assertEscopoCandidato(me, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("entrevistas")
      .update({ decisao_humana: data.decisao, decisao_por: (context as any).userId, decisao_em: new Date().toISOString() })
      .eq("id", data.entrevista_id).eq("candidato_id", data.candidatoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
