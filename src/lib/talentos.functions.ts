import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPerm, assertEscopoVaga, empresaFeatures } from "@/lib/tenant.server";

// Banco de Talentos — lado do STAFF (modelo empresa-puxa):
// a empresa busca perfis ÀS CEGAS no pool (sem nome/contato/currículo) e envia
// CONVITES por vaga; o candidato aceita no portal e só então vira candidatura,
// com os dados pessoais visíveis. Regras:
//  - só contas com visivel_pool = true (consentimento explícito do titular);
//  - gating FAIL-CLOSED pelo entitlement `banco_talentos` do plano;
//  - nunca serializar nome/email/celular/cv de quem não aceitou.

async function assertBancoTalentos(userId: string, perm: string) {
  const me = await assertPerm(userId, perm);
  const feats = await empresaFeatures(me.empresa_id);
  if (feats["banco_talentos"] !== true) {
    throw new Error("O Banco de Talentos não está incluído no plano da sua empresa.");
  }
  return me;
}

function iniciais(nome: string | null): string {
  if (!nome) return "?";
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Só a cidade do endereço (o bairro identificaria demais num perfil cego). */
function cidadeDe(endereco: string | null): string | null {
  if (!endereco) return null;
  const partes = endereco.split(",").map((p) => p.trim());
  return partes.length > 1 ? partes.slice(1).join(", ") : partes[0];
}

const PoolInput = z.object({
  busca: z.string().max(120).nullable().optional(),
});

/**
 * Banco de Talentos ÀS CEGAS, dirigido pelo MOTOR (regra do dono):
 * mostra SÓ talentos com match nas vagas ABERTAS da empresa — linhas de
 * `convites` escritas pelo QinMatch (status 'sugerido' + match_score) e as
 * já convidadas/respondidas. NUNCA o banco inteiro; o recrutador não
 * seleciona vaga — o fit já vem calculado por vaga.
 */
export const listarPoolTalentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PoolInput.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertBancoTalentos((context as any).userId, "ver_candidatos");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Vagas ABERTAS no escopo do usuário (super sem empresa vê todas).
    let vagasQ = admin.from("vagas").select("id, titulo, setor, empresa_id").eq("status", "Aberta");
    if (me.empresa_id) vagasQ = vagasQ.eq("empresa_id", me.empresa_id);
    const { data: vagasAbertas } = await vagasQ;
    const vagaMap = new Map((vagasAbertas ?? []).map((v: any) => [v.id, v]));
    if (!vagaMap.size) return { perfis: [], sem_vagas: true };

    // Sugestões do motor + convites já em andamento nessas vagas.
    const { data: sugestoes } = await admin
      .from("convites")
      .select("conta_id, vaga_id, status, match_score")
      .in("vaga_id", [...vagaMap.keys()])
      .neq("status", "cancelado")
      .order("match_score", { ascending: false, nullsFirst: false })
      .limit(500);
    const porContaSug = new Map<string, any[]>();
    for (const sug of sugestoes ?? []) {
      const arr = porContaSug.get(sug.conta_id) ?? [];
      arr.push(sug);
      porContaSug.set(sug.conta_id, arr);
    }
    if (!porContaSug.size) return { perfis: [], sem_sugestoes: true };

    // Só contas com opt-in de descobribilidade (o motor também deve filtrar).
    const { data: contas } = await admin
      .from("candidato_contas")
      .select("id, nome, endereco, cv_storage_path, cv_gerado")
      .eq("visivel_pool", true)
      .in("id", [...porContaSug.keys()]);
    const ids = (contas ?? []).map((c: any) => c.id);
    if (!ids.length) return { perfis: [] };

    const [perfis, comps, forms, exps, prefs, videos] = await Promise.all([
      admin.from("conta_perfil").select("conta_id, resumo_ia").in("conta_id", ids),
      admin
        .from("conta_competencias")
        .select("conta_id, nivel, competencia:competencias(nome, tipo)")
        .in("conta_id", ids),
      admin.from("conta_formacoes").select("conta_id, titulo, status").in("conta_id", ids),
      admin
        .from("conta_experiencias")
        .select("conta_id, tipo, titulo, status_validacao")
        .in("conta_id", ids),
      admin
        .from("conta_preferencias")
        .select("conta_id, disponibilidade, modelo_trabalho, interesses")
        .in("conta_id", ids),
      admin.from("candidato_videos").select("conta_id").in("conta_id", ids),
    ]);
    const porConta = (rows: any[] | null) => {
      const m = new Map<string, any[]>();
      (rows ?? []).forEach((r) => {
        const arr = m.get(r.conta_id) ?? [];
        arr.push(r);
        m.set(r.conta_id, arr);
      });
      return m;
    };
    const mPerfil = new Map<string, any>((perfis?.data ?? []).map((p: any) => [p.conta_id, p]));
    const mComps = porConta(comps?.data);
    const mForms = porConta(forms?.data);
    const mExps = porConta(exps?.data);
    const mPrefs = new Map<string, any>((prefs?.data ?? []).map((p: any) => [p.conta_id, p]));
    const temVideo = new Set((videos?.data ?? []).map((v: any) => v.conta_id));

    const busca = (data.busca ?? "").trim().toLowerCase();
    // ALLOWLIST do perfil cego — nome/email/celular/cv NUNCA saem daqui.
    let lista = (contas ?? []).map((c: any) => ({
      conta_id: c.id,
      iniciais: iniciais(c.nome),
      cidade: cidadeDe(c.endereco),
      tem_cv: !!c.cv_storage_path || !!c.cv_gerado,
      tem_video: temVideo.has(c.id),
      // Fit por vaga aberta, calculado pelo MOTOR (ordenado por score).
      vagas_match: (porContaSug.get(c.id) ?? [])
        .filter((sug: any) => vagaMap.has(sug.vaga_id))
        .map((sug: any) => ({
          vaga_id: sug.vaga_id,
          vaga_titulo: (vagaMap.get(sug.vaga_id) as any)?.titulo ?? null,
          match_score: sug.match_score,
          status: sug.status,
        })),
      resumo: mPerfil.get(c.id)?.resumo_ia ?? null,
      competencias: (mComps.get(c.id) ?? []).map((x: any) => ({
        nome: x.competencia?.nome,
        nivel: x.nivel,
      })),
      formacoes: (mForms.get(c.id) ?? []).map((x: any) => ({ titulo: x.titulo, status: x.status })),
      experiencias: (mExps.get(c.id) ?? []).map((x: any) => ({
        tipo: x.tipo,
        titulo: x.titulo,
        validada: x.status_validacao === "consistente_cv",
      })),
      preferencias: mPrefs.get(c.id)
        ? {
            disponibilidade: mPrefs.get(c.id).disponibilidade,
            modelo_trabalho: mPrefs.get(c.id).modelo_trabalho,
            interesses: mPrefs.get(c.id).interesses ?? [],
          }
        : null,
    }));
    // Pool útil: só quem já tem alguma substância no perfil.
    lista = lista.filter(
      (p: any) => p.resumo || p.competencias.length || p.experiencias.length || p.tem_cv,
    );
    lista.sort(
      (a: any, b: any) =>
        (b.vagas_match[0]?.match_score ?? -1) - (a.vagas_match[0]?.match_score ?? -1),
    );
    if (busca) {
      lista = lista.filter((p: any) =>
        [
          p.resumo ?? "",
          p.cidade ?? "",
          ...p.competencias.map((c: any) => c.nome ?? ""),
          ...p.experiencias.map((e: any) => e.titulo ?? ""),
          ...(p.preferencias?.interesses ?? []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(busca),
      );
    }
    return { perfis: lista };
  });

const ConviteInput = z.object({
  contaId: z.string().uuid(),
  vagaId: z.string().uuid(),
  mensagem: z.string().max(600).optional().nullable(),
});

/** Envia o convite da vaga para um perfil do pool. */
export const enviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConviteInput.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertBancoTalentos((context as any).userId, "gerenciar_vagas");
    const vaga = await assertEscopoVaga(me, data.vagaId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: conta } = await admin
      .from("candidato_contas")
      .select("id, visivel_pool")
      .eq("id", data.contaId)
      .maybeSingle();
    if (!conta?.visivel_pool) throw new Error("Este perfil não está disponível no pool.");

    // Já é candidato desta vaga? Convite seria redundante.
    const { data: jaCand } = await admin
      .from("candidatos_televendas")
      .select("id")
      .eq("conta_id", data.contaId)
      .eq("vaga_id", data.vagaId)
      .maybeSingle();
    if (jaCand) throw new Error("Esta pessoa já é candidata desta vaga.");

    // Resposta do candidato é soberana: convite aceito/recusado não se reenvia.
    const { data: existente } = await admin
      .from("convites")
      .select("status")
      .eq("vaga_id", data.vagaId)
      .eq("conta_id", data.contaId)
      .maybeSingle();
    if (existente?.status === "aceito") throw new Error("Esta pessoa já aceitou o convite.");
    if (existente?.status === "recusado") {
      throw new Error("Esta pessoa recusou o convite desta vaga.");
    }
    if (existente?.status === "pendente")
      throw new Error("Convite já enviado — aguardando resposta.");

    const { error } = await admin.from("convites").upsert(
      {
        empresa_id: (vaga as any).empresa_id ?? me.empresa_id,
        vaga_id: data.vagaId,
        conta_id: data.contaId,
        enviado_por: (context as any).userId,
        mensagem: data.mensagem?.trim() || null,
        status: "pendente",
        respondido_em: null,
      },
      { onConflict: "vaga_id,conta_id" },
    );
    if (error) throw new Error(error.message);

    // Notificação por e-mail — fire-and-forget (falha de e-mail nunca trava o convite).
    (async () => {
      const [{ data: destinatario }, { data: vagaInfo }] = await Promise.all([
        admin.from("candidato_contas").select("email, nome").eq("id", data.contaId).maybeSingle(),
        admin
          .from("vagas")
          .select("titulo, empresa:empresas(nome)")
          .eq("id", data.vagaId)
          .maybeSingle(),
      ]);
      if (!destinatario?.email) return;
      const { enviarEmail, templateAviso, siteUrl } = await import("@/lib/email.server");
      const empresaNome = (vagaInfo as any)?.empresa?.nome ?? "Uma empresa";
      await enviarEmail({
        para: destinatario.email,
        assunto: `${empresaNome} te convidou para a vaga ${vagaInfo?.titulo ?? ""}`.trim(),
        html: templateAviso({
          titulo: "Você foi convidado(a) para uma vaga! 🎉",
          corpo: `${empresaNome} viu seu perfil no banco de talentos e quer você no processo da vaga <strong>${vagaInfo?.titulo ?? ""}</strong>. Entre no portal para ver a mensagem e responder — seus dados só são compartilhados se você aceitar.`,
          ctaRotulo: "Ver convite no portal",
          ctaUrl: `${siteUrl()}/portal`,
        }),
      });
    })().catch((e) => console.error("[convite] notificação falhou:", e));

    return { ok: true };
  });

const ConviteId = z.object({ contaId: z.string().uuid(), vagaId: z.string().uuid() });

/** Cancela um convite ainda pendente. */
export const cancelarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConviteId.parse(d))
  .handler(async ({ data, context }) => {
    const me = await assertBancoTalentos((context as any).userId, "gerenciar_vagas");
    await assertEscopoVaga(me, data.vagaId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("convites")
      .update({ status: "cancelado", respondido_em: new Date().toISOString() })
      .eq("vaga_id", data.vagaId)
      .eq("conta_id", data.contaId)
      .eq("status", "pendente");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
