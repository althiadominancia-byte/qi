import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  carregarConta,
  assertDonoCandidatura,
  resolverEmpresaDaCandidatura,
  portalHabilitado,
  assertAuthSettingsSeguras,
  emailVerificadoDoUsuario,
  registrarAlteracao,
} from "@/lib/candidato-conta.server";
import { computeResults, getDiscBlocks, getSituacoes } from "@/lib/recrutamento/data";

// Portal do Candidato — server functions do TITULAR dos dados.
//
// Diferente do painel do recrutador (assertPerm/assertEscopo), aqui o acesso é
// por TITULARIDADE: a conta logada só enxerga candidaturas com o seu conta_id.
// REGRA DE OURO: nenhum retorno deste módulo pode conter campos internos do
// processo seletivo (match_final, match_label, cv_analise, disc_respostas,
// disc_pontuacao, situacionais, postura_score, nao_contratado_motivo,
// entrevista_obs, decisao_*, analise/transcricao/gravacao de entrevistas,
// match_scores, candidato_videos.transcricao/analise). SELECTs sempre com
// allowlist — NUNCA `*`.
// EXCEÇÃO aprovada pelo dono (2026-07-30): perfil_key/perfil_nome (o rótulo do
// perfil comportamental, ex. "O Comunicador") PODEM ser exibidos ao titular —
// nunca as pontuações que os originaram.

/** Versão vigente do termo de uso do portal. */
export const TERMO_PORTAL_VERSAO = "1.0";

/** Termo de uso do portal (linguagem simples, exibido no aceite). */
export const TERMO_PORTAL = `Termo de uso do Portal do Candidato (versão ${TERMO_PORTAL_VERSAO})

1. Esta conta serve para você acompanhar suas candidaturas: ver a etapa do processo, sua entrevista (quando houver) e manter seus dados de contato, experiências e competências atualizados.

2. Seus dados pessoais são acessíveis a você (titular) e às empresas às quais você se candidatou, apenas para fins de recrutamento e seleção, conforme a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).

3. Você pode corrigir seus dados a qualquer momento pelo próprio portal e pode pedir a exclusão da sua conta e dos seus dados quando quiser, pelos canais de contato da empresa.

4. Ao aceitar, você concorda com o uso dos seus dados para essas finalidades. Registramos a data e a versão deste termo no seu aceite.`;

// ===== Mapeamentos servidor→candidato (o candidato NUNCA vê o valor cru) =====

const ETAPA_ROTULOS: Record<string, string> = {
  inscrito: "Em análise",
  entrevista: "Entrevista",
  contratado: "Contratado",
  nao_contratado: "Processo encerrado", // NUNCA expor nao_contratado_motivo
};
function mapearEtapa(etapa: string | null | undefined): string {
  return ETAPA_ROTULOS[etapa ?? ""] ?? "Em análise";
}

const STATUS_ENTREVISTA_ROTULOS: Record<string, string> = {
  agendada: "Agendada",
  em_andamento: "Em andamento",
  sem_gravacao: "Agendada (sem gravação)",
  gravada: "Realizada",
  transcrita: "Realizada",
  analisada: "Realizada",
  cancelada: "Cancelada",
};
// O token do link público (/e/$token) só sai quando a entrevista ainda vai acontecer.
const STATUS_COM_LINK = new Set(["agendada", "em_andamento", "sem_gravacao"]);

/**
 * Recorte MÍNIMO da tabela entrevistas permitido ao portal. PROIBIDO ampliar
 * com: analise, transcricao, gravacao_path, decisao_humana, decisao_em,
 * decisao_por, livekit_room — e proibido reusar o select do staff
 * (getEntrevistaDoCandidato), que contém decisao_humana.
 */
type EntrevistaRow = {
  candidato_id: string;
  agendada_para: string | null;
  status: string;
  token: string;
};
type EntrevistaPublica = {
  agendada_para: string | null;
  status_rotulo: string;
  link_token?: string;
};

function montarEntrevistaPublica(e: EntrevistaRow | null | undefined): EntrevistaPublica | null {
  if (!e) return null;
  const out: EntrevistaPublica = {
    agendada_para: e.agendada_para ?? null,
    status_rotulo: STATUS_ENTREVISTA_ROTULOS[e.status] ?? "Agendada",
  };
  if (STATUS_COM_LINK.has(e.status)) out.link_token = e.token;
  return out;
}

/** Última entrevista por candidato, preferindo uma não cancelada. */
function indexarEntrevistas(rows: EntrevistaRow[]): Map<string, EntrevistaRow> {
  const map = new Map<string, EntrevistaRow>();
  for (const e of rows) {
    const atual = map.get(e.candidato_id);
    if (!atual || (atual.status === "cancelada" && e.status !== "cancelada")) {
      map.set(e.candidato_id, e);
    }
  }
  return map;
}

/** IP do requisitante (mesmo mecanismo dos registros de consentimento). */
async function capturarIp(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const h = getRequest()?.headers;
    const ip =
      h?.get("cf-connecting-ip") ||
      h?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h?.get("x-real-ip");
    return ip || null;
  } catch {
    return null;
  }
}

// Escapa curingas do ILIKE para comparar e-mail com igualdade case-insensitive.
function padraoEmail(email: string): string {
  return email.replace(/([%_\\])/g, "\\$1");
}

// ============================ 1. Conta ============================

const GarantirConta = z.object({
  nome: z.string().max(200).optional(),
  aceitouTermo: z.boolean(),
  versaoTermo: z.string().min(1).max(20),
});
/**
 * Garante a conta de candidato do usuário logado (cria no primeiro acesso,
 * exigindo o aceite do termo) e atualiza o aceite quando a versão avança.
 * Contas da equipe (linha em `usuarios`) são bloqueadas — usam o painel.
 */
export const garantirContaCandidato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GarantirConta.parse(d))
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: staff } = await admin
      .from("usuarios")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (staff) throw new Error("Contas da equipe usam o painel administrativo.");

    const { data: conta } = await admin
      .from("candidato_contas")
      .select("id, versao_termo")
      .eq("id", userId)
      .maybeSingle();

    if (!conta) {
      if (!data.aceitouTermo) {
        throw new Error("É preciso aceitar o termo de uso para criar a conta do portal.");
      }
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(userId);
      const email = u?.user?.email;
      if (uErr || !email) throw new Error("Usuário não encontrado.");
      const { error } = await admin.from("candidato_contas").insert({
        id: userId,
        email: String(email).trim().toLowerCase(),
        nome: data.nome?.trim() || null,
        versao_termo: data.versaoTermo,
        aceitou_termos_em: new Date().toISOString(),
        aceite_ip: await capturarIp(),
      });
      if (error) throw new Error(error.message);
      return { ok: true, precisaAceite: false, versaoAtual: data.versaoTermo };
    }

    // Conta já existe: atualiza o aceite se a versão enviada for mais nova.
    const gravada = (conta.versao_termo ?? "") as string;
    if (data.aceitouTermo && data.versaoTermo > gravada) {
      const { error } = await admin
        .from("candidato_contas")
        .update({
          versao_termo: data.versaoTermo,
          aceitou_termos_em: new Date().toISOString(),
          aceite_ip: await capturarIp(),
        })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, precisaAceite: false, versaoAtual: data.versaoTermo };
    }
    return {
      ok: true,
      precisaAceite: gravada < TERMO_PORTAL_VERSAO,
      versaoAtual: conta.versao_termo ?? null,
    };
  });

// ===================== 2–3. Reivindicação de candidaturas =====================

/**
 * Candidaturas sem dono com o MESMO e-mail verificado da conta. Retorna o
 * mínimo para o candidato reconhecer a vaga — zero PII além disso.
 */
export const listarCandidaturasReivindicaveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId as string;
    await carregarConta(userId);
    const email = await emailVerificadoDoUsuario(userId);
    await assertAuthSettingsSeguras();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: cands } = await admin
      .from("candidatos_televendas")
      .select("id, vaga_id, created_at")
      .is("conta_id", null)
      .ilike("email", padraoEmail(email)) // ILIKE sem curinga = igualdade case-insensitive
      .order("created_at", { ascending: false });
    const lista: { id: string; vaga_id: string | null; created_at: string }[] = cands ?? [];
    if (!lista.length) return [];

    const vagaIds = [...new Set(lista.map((c) => c.vaga_id).filter(Boolean))] as string[];
    const { data: vagas } = vagaIds.length
      ? await admin.from("vagas").select("id, titulo, empresa_id").in("id", vagaIds)
      : { data: [] };
    const vagaMap = new Map((vagas ?? []).map((v: any) => [v.id, v]));

    const empresaIds = [
      ...new Set((vagas ?? []).map((v: any) => v.empresa_id).filter(Boolean)),
    ] as string[];
    const { data: empresas } = empresaIds.length
      ? await admin.from("empresas").select("id, nome").in("id", empresaIds)
      : { data: [] };
    const empresaMap = new Map((empresas ?? []).map((e: any) => [e.id, e.nome as string]));

    return lista.map((c) => {
      const vaga: any = c.vaga_id ? vagaMap.get(c.vaga_id) : null;
      return {
        id: c.id,
        vaga_titulo: vaga?.titulo ?? null,
        empresa_nome: vaga?.empresa_id ? (empresaMap.get(vaga.empresa_id) ?? null) : null,
        created_at: c.created_at,
      };
    });
  });

const Reivindicar = z.object({
  candidatoId: z.string().uuid(),
  celularDigitos: z.string().regex(/^\d{4}$/),
});
/**
 * Vincula uma candidatura órfã à conta. Prova de posse dupla: e-mail
 * VERIFICADO igual + 4 últimos dígitos do celular informado na inscrição.
 * Tentativas erradas são registradas e limitadas (5/hora).
 */
export const reivindicarCandidatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Reivindicar.parse(d))
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const conta = await carregarConta(userId);
    const email = await emailVerificadoDoUsuario(userId);
    await assertAuthSettingsSeguras();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Rate limit: 5 tentativas falhas por hora por conta.
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("candidato_conta_vinculos")
      .select("id", { count: "exact", head: true })
      .eq("conta_id", conta.id)
      .eq("sucesso", false)
      .gte("created_at", umaHoraAtras);
    if ((count ?? 0) >= 5) throw new Error("Muitas tentativas. Aguarde 1 hora.");

    const { data: cand } = await admin
      .from("candidatos_televendas")
      .select("id, email, celular, conta_id")
      .eq("id", data.candidatoId)
      .is("conta_id", null)
      .maybeSingle();
    if (
      !cand ||
      String(cand.email ?? "")
        .trim()
        .toLowerCase() !== email
    ) {
      throw new Error("Candidatura não disponível para reivindicação.");
    }

    const digitos = String(cand.celular ?? "").replace(/\D/g, "");
    if (digitos.length < 4 || digitos.slice(-4) !== data.celularDigitos) {
      await admin.from("candidato_conta_vinculos").insert({
        conta_id: conta.id,
        candidato_id: data.candidatoId,
        sucesso: false,
      });
      throw new Error("Dígitos não conferem.");
    }

    // `is null` de novo no UPDATE: impede corrida de duas contas reivindicando.
    const { error } = await admin
      .from("candidatos_televendas")
      .update({ conta_id: conta.id })
      .eq("id", data.candidatoId)
      .is("conta_id", null);
    if (error) throw new Error(error.message);
    await admin.from("candidato_conta_vinculos").insert({
      conta_id: conta.id,
      candidato_id: data.candidatoId,
      sucesso: true,
    });
    return { ok: true };
  });

// ============================ 4–5. Leitura ============================

/** Painel do candidato: todas as suas candidaturas, só com a visão permitida. */
export const getMeuPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId as string;
    const conta = await carregarConta(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: cands } = await admin
      .from("candidatos_televendas")
      // disc_pontuacao/situacionais entram SÓ para calcular flags de pendência —
      // NUNCA saem na resposta (lista PROIBIDO).
      .select(
        "id, vaga_id, empresa_id, etapa, entrevista_data, created_at, disc_pontuacao, situacionais",
      )
      .eq("conta_id", conta.id)
      .order("created_at", { ascending: false });
    const lista: any[] = cands ?? [];

    const vagaIds = [...new Set(lista.map((c) => c.vaga_id).filter(Boolean))] as string[];
    const candIds = lista.map((c) => c.id);
    const [{ data: vagas }, { data: ents }, { data: videos }] = await Promise.all([
      vagaIds.length
        ? admin
            .from("vagas")
            .select("id, titulo, empresa_id, usar_situacional, situacoes")
            .in("id", vagaIds)
        : Promise.resolve({ data: [] }),
      candIds.length
        ? admin
            .from("entrevistas")
            // NUNCA acrescentar: analise, transcricao, gravacao_path, decisao_* (ver EntrevistaRow)
            .select("id, candidato_id, agendada_para, status, token")
            .in("candidato_id", candIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      candIds.length
        ? admin.from("candidato_videos").select("candidato_id").in("candidato_id", candIds)
        : Promise.resolve({ data: [] }),
    ]);
    const temVideo = new Set((videos ?? []).map((v: any) => v.candidato_id));
    const vagaMap = new Map((vagas ?? []).map((v: any) => [v.id, v]));
    const entMap = indexarEntrevistas((ents ?? []) as EntrevistaRow[]);

    // Empresa da candidatura em lote (mesma regra de resolverEmpresaDaCandidatura:
    // empresa_id direto ou derivado da vaga).
    const empresaDe = (c: any): string | null =>
      c.empresa_id ?? (c.vaga_id ? ((vagaMap.get(c.vaga_id) as any)?.empresa_id ?? null) : null);

    const empresaIds = [...new Set(lista.map(empresaDe).filter(Boolean))] as string[];
    const { data: empresas } = empresaIds.length
      ? await admin.from("empresas").select("id, nome").in("id", empresaIds)
      : { data: [] };
    const empresaMap = new Map((empresas ?? []).map((e: any) => [e.id, e.nome as string]));

    const featCache = new Map<string, boolean>();
    const videoFeatCache = new Map<string, boolean>();
    const candidaturas: any[] = [];
    for (const c of lista) {
      const empresaId = empresaDe(c);
      let ativo = false;
      if (empresaId) {
        if (!featCache.has(empresaId)) featCache.set(empresaId, await portalHabilitado(empresaId));
        ativo = featCache.get(empresaId) === true;
      }
      const vaga: any = c.vaga_id ? vagaMap.get(c.vaga_id) : null;
      const base = {
        id: c.id,
        vaga_titulo: vaga?.titulo ?? null,
        empresa_nome: empresaId ? (empresaMap.get(empresaId) ?? null) : null,
      };
      if (!ativo) {
        // LGPD art. 18: a candidatura continua VISÍVEL ao titular, só sem os
        // recursos do portal (empresa sem o entitlement).
        candidaturas.push({ ...base, portal_ativo: false });
        continue;
      }
      const discPend = !c.disc_pontuacao || Object.keys(c.disc_pontuacao).length === 0;
      const sitLista = vaga?.usar_situacional === false ? [] : getSituacoes(vaga);
      const sitPend =
        sitLista.length > 0 && (!c.situacionais || Object.keys(c.situacionais).length === 0);
      if (empresaId && !videoFeatCache.has(empresaId)) {
        videoFeatCache.set(empresaId, await videoHabilitado(empresaId));
      }
      const videoPend =
        !!empresaId && videoFeatCache.get(empresaId) === true && !temVideo.has(c.id);
      candidaturas.push({
        ...base,
        portal_ativo: true,
        etapa_mapeada: mapearEtapa(c.etapa),
        entrevista: montarEntrevistaPublica(entMap.get(c.id)),
        pendencias: { avaliacoes: discPend || sitPend, video: videoPend },
      });
    }

    const { data: contaFlags } = await admin
      .from("candidato_contas")
      .select("celular, cv_storage_path, cv_gerado")
      .eq("id", conta.id)
      .maybeSingle();

    return {
      candidaturas,
      perfil_flags: {
        tem_celular: !!contaFlags?.celular,
        tem_cv: !!contaFlags?.cv_storage_path || !!contaFlags?.cv_gerado,
      },
      precisaAceite: (conta.versao_termo ?? "") < TERMO_PORTAL_VERSAO,
    };
  });

const CandId = z.object({ candidatoId: z.string().uuid() });

/** Detalhe de UMA candidatura do titular (dados + etapa + entrevista + passaporte). */
export const getMinhaCandidatura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    if (!(await portalHabilitado(empresaId))) {
      throw new Error("Portal não disponível para esta empresa.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [branding, ents, comps, exps, prefs, evids, aval, vagaCfg, aceitaCv, vid, videoOn] =
      await Promise.all([
        admin.rpc("get_empresa_branding", { p_empresa_id: empresaId }),
        admin
          .from("entrevistas")
          // NUNCA acrescentar: analise, transcricao, gravacao_path, decisao_* (ver EntrevistaRow)
          .select("id, candidato_id, agendada_para, status, token")
          .eq("candidato_id", cand.id)
          .order("created_at", { ascending: false }),
        admin
          .from("candidato_competencias")
          .select("id, nivel, origem, competencia:competencias(id, nome, tipo)")
          .eq("candidato_id", cand.id),
        admin
          .from("candidato_experiencias")
          .select("id, tipo, titulo, organizacao, inicio, fim, atual, descricao")
          .eq("candidato_id", cand.id)
          .order("inicio", { ascending: false, nullsFirst: false }),
        admin
          .from("candidato_preferencias")
          .select("disponibilidade, pretensao_min, pretensao_max, modelo_trabalho, interesses")
          .eq("candidato_id", cand.id)
          .maybeSingle(),
        admin
          .from("candidato_evidencias")
          .select("id, tipo, titulo, descricao, url, storage_path, created_at")
          .eq("candidato_id", cand.id)
          .order("created_at", { ascending: false }),
        // Leitura INTERNA (nunca serializada crua): estado das avaliações + perfil.
        admin
          .from("candidatos_televendas")
          .select("disc_pontuacao, situacionais, perfil_key, perfil_nome, cv_nome_arquivo")
          .eq("id", cand.id)
          .maybeSingle(),
        cand.vaga_id
          ? admin
              .from("vagas")
              .select("id, usar_situacional, disc_blocks, situacoes")
              .eq("id", cand.vaga_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        cand.vaga_id
          ? admin.rpc("vaga_aceita_inscricao", { _vaga_id: cand.vaga_id })
          : Promise.resolve({ data: false }),
        // NUNCA selecionar transcricao/analise aqui — são internas (staff).
        admin
          .from("candidato_videos")
          .select("id, duracao_s, created_at")
          .eq("candidato_id", cand.id)
          .maybeSingle(),
        videoHabilitado(empresaId),
      ]);

    const b = Array.isArray(branding?.data) ? branding.data[0] : branding?.data;
    const entMap = indexarEntrevistas((ents?.data ?? []) as EntrevistaRow[]);

    // Pendências de avaliação (valores crus ficam no servidor; só flags saem).
    const a = aval?.data ?? {};
    const vaga = vagaCfg?.data ?? null;
    const discPendente = !a.disc_pontuacao || Object.keys(a.disc_pontuacao).length === 0;
    const sitLista = vaga?.usar_situacional === false ? [] : getSituacoes(vaga);
    const sitPendente =
      sitLista.length > 0 && (!a.situacionais || Object.keys(a.situacionais).length === 0);
    const cvAtualizavel = aceitaCv?.data === true;

    return {
      dados: {
        nome: cand.nome,
        email: cand.email,
        celular: cand.celular,
        endereco: cand.endereco,
        setor_atual: cand.setor_atual,
        tempo_empresa: cand.tempo_empresa,
      },
      etapa_mapeada: mapearEtapa(cand.etapa),
      // uuid da empresa — necessário ao cliente para montar paths de upload.
      empresa_id: empresaId,
      empresa: b
        ? {
            nome: b.nome ?? null,
            logo_path: b.logo_path ?? null,
            cor_primaria: b.cor_primaria ?? null,
            cor_sidebar: b.cor_sidebar ?? null,
            cor_botao: b.cor_botao ?? null,
          }
        : null,
      entrevista: montarEntrevistaPublica(entMap.get(cand.id)),
      passaporte: {
        competencias: comps?.data ?? [],
        experiencias: exps?.data ?? [],
        preferencias: prefs?.data ?? null,
        evidencias: (evids?.data ?? []).map((e: any) => ({
          id: e.id,
          tipo: e.tipo,
          titulo: e.titulo,
          descricao: e.descricao,
          url: e.url,
          tem_arquivo: !!e.storage_path,
          created_at: e.created_at,
        })),
      },
      // Rótulo do perfil comportamental (exceção aprovada — nunca pontuações).
      perfil: a.perfil_key ? { key: a.perfil_key, nome: a.perfil_nome ?? null } : null,
      avaliacoes: {
        disc_pendente: discPendente,
        situacional_pendente: sitPendente,
        // Config só quando há algo a responder (blocos/questões prontos p/ UI).
        config:
          discPendente || sitPendente
            ? {
                blocos: discPendente ? getDiscBlocks(vaga) : [],
                situacoes: sitPendente ? sitLista : [],
              }
            : null,
      },
      video: {
        habilitado: videoOn === true,
        tem_video: !!vid?.data,
        duracao_s: vid?.data?.duracao_s ?? null,
        criado_em: vid?.data?.created_at ?? null,
      },
      cv: {
        nome_arquivo: a.cv_nome_arquivo ?? null,
        tem_arquivo: !!cand.cv_storage_path,
        atualizavel: cvAtualizavel,
        // Necessário para o cliente montar o path de upload (convenção do funil).
        upload: cvAtualizavel ? { empresa_id: empresaId, vaga_id: cand.vaga_id } : null,
      },
    };
  });

// ==================== 6. Dados cadastrais do titular ====================

const AtualizarDados = z.object({
  candidatoId: z.string().uuid(),
  nome: z.string().min(1).max(200),
  celular: z.string().min(8).max(40),
  endereco: z.string().max(500).optional().nullable(),
});
/** Atualiza os dados de contato do titular (NUNCA o e-mail — é a identidade). */
export const atualizarMeusDados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AtualizarDados.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const novos: Record<string, string | null> = {
      nome: data.nome,
      celular: data.celular,
      endereco: data.endereco ?? null,
    };
    const alterados = (Object.keys(novos) as (keyof typeof novos)[]).filter(
      (campo) => (cand as any)[campo] !== novos[campo],
    );
    if (!alterados.length) return { ok: true };

    const { error } = await admin
      .from("candidatos_televendas")
      .update(novos)
      .eq("id", cand.id)
      .eq("conta_id", conta.id);
    if (error) throw new Error(error.message);
    for (const campo of alterados) {
      await registrarAlteracao(
        cand.id,
        empresaId,
        String(campo),
        (cand as any)[campo] ?? null,
        novos[campo],
      );
    }
    return { ok: true };
  });

// ==================== 7–8. Competências declaradas ====================

const MinhaComp = z.object({
  candidatoId: z.string().uuid(),
  competencia_id: z.string().uuid(),
  nivel: z.number().int().min(1).max(5),
});
/** Declara/ajusta uma competência do titular. Nunca sobrescreve origem ia/avaliada. */
export const salvarMinhaCompetencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MinhaComp.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: existente } = await admin
      .from("candidato_competencias")
      .select("id, nivel, origem")
      .eq("candidato_id", cand.id)
      .eq("competencia_id", data.competencia_id)
      .maybeSingle();
    if (existente && existente.origem !== "declarada") {
      throw new Error(
        "Esta competência tem avaliação registrada pela empresa e não pode ser alterada.",
      );
    }
    const { error } = await admin.from("candidato_competencias").upsert(
      {
        candidato_id: cand.id,
        competencia_id: data.competencia_id,
        nivel: data.nivel,
        origem: "declarada",
      },
      { onConflict: "candidato_id,competencia_id" },
    );
    if (error) throw new Error(error.message);
    await registrarAlteracao(
      cand.id,
      empresaId,
      `competencia:${data.competencia_id}`,
      existente ? String(existente.nivel) : null,
      String(data.nivel),
    );
    return { ok: true };
  });

const DelById = z.object({ candidatoId: z.string().uuid(), id: z.string().uuid() });
/** Remove uma competência DECLARADA (o filtro de origem vai na query). */
export const removerMinhaCompetencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DelById.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("candidato_competencias")
      .delete()
      .eq("id", data.id)
      .eq("candidato_id", cand.id)
      .eq("origem", "declarada");
    if (error) throw new Error(error.message);
    await registrarAlteracao(cand.id, empresaId, "competencia_removida", data.id, null);
    return { ok: true };
  });

// ======================= 9–10. Experiências =======================

const MinhaExp = z.object({
  candidatoId: z.string().uuid(),
  id: z.string().uuid().optional(),
  tipo: z.enum(["formal", "informal", "voluntariado", "projeto", "curso"]).default("formal"),
  titulo: z.string().min(1).max(200),
  organizacao: z.string().max(200).optional().nullable(),
  inicio: z.string().optional().nullable(),
  fim: z.string().optional().nullable(),
  atual: z.boolean().default(false),
  descricao: z.string().max(2000).optional().nullable(),
});
export const salvarMinhaExperiencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MinhaExp.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const row = {
      candidato_id: cand.id,
      tipo: data.tipo,
      titulo: data.titulo,
      organizacao: data.organizacao ?? null,
      inicio: data.inicio || null,
      fim: data.fim || null,
      atual: data.atual,
      descricao: data.descricao ?? null,
    };
    const q = admin.from("candidato_experiencias");
    // No update, o .eq('candidato_id') impede editar experiência de outro candidato.
    const { error } = data.id
      ? await q.update(row).eq("id", data.id).eq("candidato_id", cand.id)
      : await q.insert(row);
    if (error) throw new Error(error.message);
    await registrarAlteracao(
      cand.id,
      empresaId,
      data.id ? "experiencia_editada" : "experiencia_adicionada",
      null,
      data.titulo,
    );
    return { ok: true };
  });

export const removerMinhaExperiencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DelById.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("candidato_experiencias")
      .delete()
      .eq("id", data.id)
      .eq("candidato_id", cand.id);
    if (error) throw new Error(error.message);
    await registrarAlteracao(cand.id, empresaId, "experiencia_removida", data.id, null);
    return { ok: true };
  });

// ======================= 11. Preferências =======================

const MinhasPrefs = z.object({
  candidatoId: z.string().uuid(),
  disponibilidade: z.string().max(200).optional().nullable(),
  pretensao_min: z.number().optional().nullable(),
  pretensao_max: z.number().optional().nullable(),
  modelo_trabalho: z.enum(["presencial", "hibrido", "remoto", "indiferente"]).optional().nullable(),
  interesses: z.array(z.string()).default([]),
});
export const salvarMinhasPreferencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MinhasPrefs.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("candidato_preferencias").upsert(
      {
        candidato_id: cand.id,
        disponibilidade: data.disponibilidade ?? null,
        pretensao_min: data.pretensao_min ?? null,
        pretensao_max: data.pretensao_max ?? null,
        modelo_trabalho: data.modelo_trabalho ?? null,
        interesses: data.interesses,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "candidato_id" },
    );
    if (error) throw new Error(error.message);
    await registrarAlteracao(cand.id, empresaId, "preferencias", null, "atualizadas");
    return { ok: true };
  });

// ================= 12. Taxonomia visível à candidatura =================

/**
 * Competências disponíveis para o titular declarar: globais + da empresa da
 * candidatura POSSUÍDA (a empresa nunca vem do cliente).
 */
export const listCompetenciasDaCandidatura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orFiltro = empresaId
      ? `empresa_id.is.null,empresa_id.eq.${empresaId}`
      : "empresa_id.is.null";
    const { data: comps } = await (supabaseAdmin as any)
      .from("competencias")
      .select("id, nome, tipo")
      .eq("ativo", true)
      .or(orFiltro)
      .order("tipo")
      .order("nome");
    return comps ?? [];
  });

// ======================= 13. Currículo do titular =======================

/** URL assinada e curta (90s) do PRÓPRIO currículo. O path nunca vem do cliente. */
export const urlMeuCurriculo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    if (!cand.cv_storage_path) throw new Error("Currículo não encontrado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("curriculos")
      .createSignedUrl(cand.cv_storage_path, 90);
    if (error || !signed?.signedUrl) throw new Error("Não foi possível gerar o link do currículo.");
    return { url: signed.signedUrl };
  });

const AtualizarCv = z.object({
  candidatoId: z.string().uuid(),
  storagePath: z.string().min(5).max(400),
  nomeArquivo: z.string().min(1).max(200),
});
/**
 * Registra um novo currículo enviado pelo TITULAR (o upload é client-side, no
 * bucket `curriculos`, pela mesma policy/convenção do funil público). Só com a
 * vaga ainda aceitando inscrições — depois disso o processo está fechado.
 * A re-análise é disparada pelo cliente via `analisarCv` (pública), que valida
 * o path contra a inscrição já atualizada.
 */
export const atualizarMeuCurriculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AtualizarCv.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    if (!cand.vaga_id) throw new Error("Candidatura sem vaga vinculada.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: aceita } = await admin.rpc("vaga_aceita_inscricao", { _vaga_id: cand.vaga_id });
    if (aceita !== true) {
      throw new Error("Esta vaga não está mais recebendo currículos.");
    }
    // Path EXATAMENTE na convenção do funil: <empresa>/<vaga>/<arquivo>.
    const prefixo = `${empresaId}/${cand.vaga_id}/`;
    if (!data.storagePath.startsWith(prefixo) || data.storagePath.includes("..")) {
      throw new Error("Caminho de arquivo inválido.");
    }
    const { error } = await admin
      .from("candidatos_televendas")
      .update({ cv_storage_path: data.storagePath, cv_nome_arquivo: data.nomeArquivo })
      .eq("id", cand.id)
      .eq("conta_id", conta.id);
    if (error) throw new Error(error.message);
    await registrarAlteracao(
      cand.id,
      empresaId,
      "curriculo",
      cand.cv_storage_path ?? null,
      data.storagePath,
    );
    return { ok: true };
  });

// ==================== 14. Avaliações pendentes do titular ====================

const SalvarAvaliacoes = z.object({
  candidatoId: z.string().uuid(),
  // Respostas CRUAS no formato do funil: disc_<i>_mais / disc_<i>_menos (índice
  // 0-3) e sit_<i> ("o0".."o3"). O servidor recalcula TUDO (integridade).
  respostas: z.record(z.string(), z.union([z.number().int().min(0).max(3), z.string().max(4)])),
});
/** Completa DISC/situacional pendentes. NUNCA sobrescreve avaliação já feita. */
export const salvarMinhasAvaliacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SalvarAvaliacoes.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    if (!cand.vaga_id) throw new Error("Candidatura sem vaga vinculada.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [{ data: atual }, { data: vaga }] = await Promise.all([
      admin
        .from("candidatos_televendas")
        .select("disc_pontuacao, situacionais")
        .eq("id", cand.id)
        .maybeSingle(),
      admin
        .from("vagas")
        .select("id, pesos, disc_blocks, situacoes, usar_situacional")
        .eq("id", cand.vaga_id)
        .maybeSingle(),
    ]);
    if (atual?.disc_pontuacao && Object.keys(atual.disc_pontuacao).length > 0) {
      throw new Error("Sua avaliação já foi registrada e não pode ser refeita.");
    }
    if (!vaga) throw new Error("Vaga não encontrada.");

    // Recalcula no SERVIDOR a partir das respostas cruas (não confia no cliente).
    const blocos = getDiscBlocks(vaga);
    const completos = blocos.every(
      (_b, bi) =>
        typeof data.respostas[`disc_${bi}_mais`] === "number" &&
        typeof data.respostas[`disc_${bi}_menos`] === "number" &&
        data.respostas[`disc_${bi}_mais`] !== data.respostas[`disc_${bi}_menos`],
    );
    if (!completos) throw new Error("Responda todos os blocos (um Mais e um Menos por bloco).");
    const r = computeResults(data.respostas, vaga);

    const discResp: Record<string, number> = {};
    blocos.forEach((_b, bi) => {
      discResp[`b${bi}_mais`] = data.respostas[`disc_${bi}_mais`] as number;
      discResp[`b${bi}_menos`] = data.respostas[`disc_${bi}_menos`] as number;
    });
    const sitLista = vaga.usar_situacional === false ? [] : getSituacoes(vaga);
    const sitResp: Record<string, string> = {};
    sitLista.forEach((_q, i) => {
      const ans = data.respostas[`sit_${i}`];
      if (typeof ans === "string") sitResp[`q${i}`] = ans;
    });

    const { error } = await admin
      .from("candidatos_televendas")
      .update({
        disc_respostas: discResp,
        disc_pontuacao: r.discPct,
        situacionais: sitResp,
        postura_score: r.sitAvg,
        perfil_key: r.key,
        perfil_nome: r.perfil.nome,
        match_final: r.finalMatch,
        match_label: r.label,
      })
      .eq("id", cand.id)
      .eq("conta_id", conta.id);
    if (error) throw new Error(error.message);
    await registrarAlteracao(cand.id, empresaId, "avaliacoes", null, "concluidas pelo titular");
    // O titular vê APENAS o rótulo do perfil — nada de pontuações.
    return { ok: true, perfil: { key: r.key, nome: r.perfil.nome } };
  });

// ======================= 15. Evidências do titular =======================

const TIPOS_EVIDENCIA = [
  "projeto",
  "certificado",
  "portfolio",
  "experiencia",
  "desafio",
  "link",
] as const;

const SalvarEvidencia = z.object({
  candidatoId: z.string().uuid(),
  tipo: z.enum(TIPOS_EVIDENCIA),
  titulo: z.string().min(1).max(200),
  descricao: z.string().max(1000).optional().nullable(),
  url: z.string().url().max(500).optional().nullable(),
  storagePath: z.string().max(400).optional().nullable(),
});
/** Adiciona evidência do passaporte (arquivo já enviado ao bucket OU link). */
export const salvarMinhaEvidencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SalvarEvidencia.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    if (data.storagePath) {
      const prefixo = `${empresaId}/${cand.id}/`;
      if (!data.storagePath.startsWith(prefixo) || data.storagePath.includes("..")) {
        throw new Error("Caminho de arquivo inválido.");
      }
    }
    if (!data.storagePath && !data.url) {
      throw new Error("Envie um arquivo ou informe um link.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("candidato_evidencias").insert({
      candidato_id: cand.id,
      tipo: data.tipo,
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      url: data.url ?? null,
      storage_path: data.storagePath ?? null,
    });
    if (error) throw new Error(error.message);
    await registrarAlteracao(
      cand.id,
      empresaId,
      "evidencia",
      null,
      `+ ${data.tipo}: ${data.titulo}`,
    );
    return { ok: true };
  });

const RemoverEvidencia = z.object({ candidatoId: z.string().uuid(), id: z.string().uuid() });
export const removerMinhaEvidencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RemoverEvidencia.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: ev } = await admin
      .from("candidato_evidencias")
      .select("id, titulo, storage_path")
      .eq("id", data.id)
      .eq("candidato_id", cand.id)
      .maybeSingle();
    if (!ev) throw new Error("Evidência não encontrada.");
    const { error } = await admin
      .from("candidato_evidencias")
      .delete()
      .eq("id", data.id)
      .eq("candidato_id", cand.id);
    if (error) throw new Error(error.message);
    if (ev.storage_path) {
      // Best-effort: registro removido é o que vale; arquivo órfão não vaza (bucket privado).
      await admin.storage
        .from("evidencias")
        .remove([ev.storage_path])
        .catch(() => {});
    }
    await registrarAlteracao(cand.id, empresaId, "evidencia", ev.titulo, "removida pelo titular");
    return { ok: true };
  });

/** URL assinada e curta (90s) de uma evidência do PRÓPRIO passaporte. */
export const urlMinhaEvidencia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RemoverEvidencia.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: ev } = await admin
      .from("candidato_evidencias")
      .select("storage_path")
      .eq("id", data.id)
      .eq("candidato_id", cand.id)
      .maybeSingle();
    if (!ev?.storage_path) throw new Error("Arquivo não encontrado.");
    const { data: signed, error } = await admin.storage
      .from("evidencias")
      .createSignedUrl(ev.storage_path, 90);
    if (error || !signed?.signedUrl) throw new Error("Não foi possível gerar o link.");
    return { url: signed.signedUrl };
  });

// ==================== 16. Vídeo-pitch do titular ====================

/** Versão vigente do termo de consentimento do vídeo. */
export const TERMO_VIDEO_VERSAO = "1.0";
export const TERMO_VIDEO = `Consentimento do vídeo de apresentação (versão ${TERMO_VIDEO_VERSAO})

1. Você autoriza o uso da sua imagem e voz neste vídeo, exclusivamente para avaliação nos processos seletivos desta candidatura (LGPD — Lei nº 13.709/2018).

2. A empresa poderá assistir ao vídeo e usar uma transcrição do que você DISSE como apoio à avaliação. A decisão sobre o processo é sempre de uma pessoa, nunca automática.

3. Você pode remover o vídeo a qualquer momento pelo portal — isso apaga o arquivo e revoga este consentimento.`;

// Feature FAIL-CLOSED (exposição de imagem/voz): exige true explícito no plano/override.
async function videoHabilitado(empresaId: string | null): Promise<boolean> {
  if (!empresaId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data: e } = await admin
    .from("empresas")
    .select("plano_id, features")
    .eq("id", empresaId)
    .maybeSingle();
  if (!e) return false;
  let plano: Record<string, boolean> | null = null;
  if (e.plano_id) {
    const { data: p } = await admin
      .from("planos")
      .select("features")
      .eq("id", e.plano_id)
      .maybeSingle();
    plano = p?.features ?? null;
  }
  const merged = { ...(plano ?? {}), ...(e.features ?? {}) } as Record<string, boolean>;
  return merged["video_pitch"] === true;
}

const SalvarVideo = z.object({
  candidatoId: z.string().uuid(),
  storagePath: z.string().min(5).max(400),
  duracaoS: z.number().int().min(1).max(120),
  aceitouTermo: z.boolean(),
  versaoTermo: z.string().min(1).max(20),
});
/** Registra o vídeo-pitch (upload já feito no bucket `videos` pelo titular). */
export const salvarMeuVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SalvarVideo.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    if (!(await videoHabilitado(empresaId))) {
      throw new Error("Vídeo de apresentação não disponível para esta empresa.");
    }
    if (!data.aceitouTermo) throw new Error("É preciso aceitar o termo do vídeo.");
    const prefixo = `${empresaId}/${cand.id}/`;
    if (!data.storagePath.startsWith(prefixo) || data.storagePath.includes("..")) {
      throw new Error("Caminho de arquivo inválido.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    // 1 vídeo por candidatura: substitui o anterior (registro + arquivo).
    const { data: antigo } = await admin
      .from("candidato_videos")
      .select("id, storage_path")
      .eq("candidato_id", cand.id)
      .maybeSingle();
    if (antigo) {
      await admin.from("candidato_videos").delete().eq("id", antigo.id);
      if (antigo.storage_path && antigo.storage_path !== data.storagePath) {
        await admin.storage
          .from("videos")
          .remove([antigo.storage_path])
          .catch(() => {});
      }
    }
    const { error } = await admin.from("candidato_videos").insert({
      candidato_id: cand.id,
      empresa_id: empresaId,
      storage_path: data.storagePath,
      duracao_s: data.duracaoS,
      versao_termo: data.versaoTermo,
      consentiu_em: new Date().toISOString(),
      aceite_ip: await capturarIp(),
    });
    if (error) throw new Error(error.message);
    await registrarAlteracao(
      cand.id,
      empresaId,
      "video_pitch",
      antigo ? "substituído" : null,
      `enviado (${data.duracaoS}s)`,
    );
    return { ok: true };
  });

/**
 * Transcreve e analisa o CONTEÚDO FALADO do vídeo (fire-and-forget do cliente).
 * transcricao/analise são INTERNAS (staff) — nunca retornadas ao titular.
 */
export const processarMeuVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: video } = await admin
      .from("candidato_videos")
      .select("id, storage_path")
      .eq("candidato_id", cand.id)
      .maybeSingle();
    if (!video) throw new Error("Vídeo não encontrado.");

    const { data: file, error: dErr } = await admin.storage
      .from("videos")
      .download(video.storage_path);
    if (dErr || !file) throw new Error("Não foi possível ler o vídeo.");
    const { transcreverAudio } = await import("@/lib/stt.server");
    const transcricao = await transcreverAudio(await file.arrayBuffer(), "pitch.webm");

    const { data: vaga } = cand.vaga_id
      ? await admin
          .from("vagas")
          .select("titulo, setor, descricao")
          .eq("id", cand.vaga_id)
          .maybeSingle()
      : { data: null };
    const { callClaude } = await import("@/lib/recrutamento.functions");
    const analise = await callClaude([
      {
        type: "text",
        text: `Você é analista de RH. Abaixo, a TRANSCRIÇÃO do vídeo de apresentação de um(a) profissional (perfil NEUTRO — não cite nem presuma nenhuma vaga).

REGRAS INEGOCIÁVEIS: analise SOMENTE o conteúdo falado (o que a pessoa disse). NÃO infira nem comente aparência, emoção, sotaque, idade, gênero ou qualquer característica pessoal. A análise é APOIO à decisão humana.

Responda SOMENTE com JSON válido neste formato:
{"resumo":"2 frases sobre o que a pessoa comunicou","comunicacao":"forte|media|fraca","comunicacao_justificativa":"1 frase sobre clareza/estrutura DO DISCURSO","pontos_fortes":["",""],"atencao":["",""],"perguntas_entrevista":["",""]}
Máximo 3 itens por lista. Português do Brasil.

TRANSCRIÇÃO:\n${transcricao.slice(0, 8000)}`,
      },
    ]);

    const { error } = await admin
      .from("candidato_videos")
      .update({ transcricao, analise })
      .eq("id", video.id);
    if (error) throw new Error(error.message);
    // Titular recebe só a confirmação — transcricao/analise ficam no servidor.
    return { ok: true };
  });

/** URL assinada e curta (90s) do PRÓPRIO vídeo. */
export const urlMeuVideo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: video } = await admin
      .from("candidato_videos")
      .select("storage_path")
      .eq("candidato_id", cand.id)
      .maybeSingle();
    if (!video?.storage_path) throw new Error("Vídeo não encontrado.");
    const { data: signed, error } = await admin.storage
      .from("videos")
      .createSignedUrl(video.storage_path, 90);
    if (error || !signed?.signedUrl) throw new Error("Não foi possível gerar o link.");
    return { url: signed.signedUrl };
  });

/** Remove o vídeo (revoga o consentimento — LGPD). */
export const removerMeuVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: video } = await admin
      .from("candidato_videos")
      .select("id, storage_path")
      .eq("candidato_id", cand.id)
      .maybeSingle();
    if (!video) return { ok: true };
    await admin.from("candidato_videos").delete().eq("id", video.id);
    if (video.storage_path)
      await admin.storage
        .from("videos")
        .remove([video.storage_path])
        .catch(() => {});
    await registrarAlteracao(cand.id, empresaId, "video_pitch", "removido pelo titular", null);
    return { ok: true };
  });

// ==================== 17. Exclusão de conta (LGPD art. 18) ====================

const ExcluirConta = z.object({
  confirmacao: z.literal("EXCLUIR", {
    errorMap: () => ({ message: "Digite EXCLUIR para confirmar." }),
  }),
});
/**
 * Exclusão self-service da conta do portal, como prometido no termo de uso.
 * Apaga: conta, vínculos e vídeos-pitch (consentimento revogável) + o login.
 * NÃO apaga as candidaturas: elas pertencem ao processo seletivo da empresa
 * (controladora) e ficam apenas DESVINCULADAS (conta_id => NULL via FK). A
 * exclusão da candidatura em si é pedido do titular à empresa (art. 18).
 */
export const excluirMinhaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExcluirConta.parse(d))
  .handler(async ({ context }) => {
    const userId = (context as any).userId as string;
    const conta = await carregarConta(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Trilha por candidatura vinculada (antes de perder o vínculo).
    const { data: cands } = await admin
      .from("candidatos_televendas")
      .select("id, empresa_id")
      .eq("conta_id", conta.id);
    for (const c of cands ?? []) {
      await registrarAlteracao(
        c.id,
        c.empresa_id ?? null,
        "conta",
        "vinculada",
        "conta excluída pelo titular",
      );
    }

    // Vídeos-pitch: consentimento revogável — registro + arquivo.
    for (const c of cands ?? []) {
      const { data: vids } = await admin
        .from("candidato_videos")
        .select("id, storage_path")
        .eq("candidato_id", c.id);
      for (const v of vids ?? []) {
        await admin.from("candidato_videos").delete().eq("id", v.id);
        if (v.storage_path)
          await admin.storage
            .from("videos")
            .remove([v.storage_path])
            .catch(() => {});
      }
    }

    // Conta + vínculos (candidaturas desvinculam via FK ON DELETE SET NULL).
    await admin.from("candidato_conta_vinculos").delete().eq("conta_id", conta.id);
    const { error } = await admin.from("candidato_contas").delete().eq("id", conta.id);
    if (error) throw new Error(error.message);

    // Login por último (invalida a sessão do cliente).
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { ok: true };
  });

// ================= 18. Perfil neutro do profissional (Cadastro Neutro) =================
//
// O perfil pertence à CONTA (pessoa), nunca a uma vaga — diretriz do dono: a
// classificação contra vagas disponíveis é papel do motor de match. Empresas
// não leem as tabelas conta_*; recebem PROJEÇÕES nas candidaturas delas.

const CHAVES_RESPOSTAS = [
  "sei_fazer",
  "historia_trabalho",
  "interesses",
  "preferencias_texto",
] as const;

const SalvarRespostas = z.object({
  respostas: z.object({
    sei_fazer: z.string().max(2000).optional().default(""),
    historia_trabalho: z.string().max(2000).optional().default(""),
    interesses: z.string().max(2000).optional().default(""),
    preferencias_texto: z.string().max(2000).optional().default(""),
  }),
});

/** Perfil neutro completo do titular. */
export const getMeuPerfil = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const [perfil, comps, exps, prefs, contaCv, forms] = await Promise.all([
      admin
        .from("conta_perfil")
        .select("respostas, resumo_ia, estruturado_em")
        .eq("conta_id", conta.id)
        .maybeSingle(),
      admin
        .from("conta_competencias")
        .select("id, nivel, origem, confianca, competencia:competencias(id, nome, tipo)")
        .eq("conta_id", conta.id),
      admin
        .from("conta_experiencias")
        .select(
          "id, tipo, titulo, organizacao, inicio, fim, atual, descricao, origem, confianca, status_validacao, pendencia",
        )
        .eq("conta_id", conta.id)
        .order("created_at", { ascending: false }),
      admin
        .from("conta_preferencias")
        .select("disponibilidade, pretensao_min, pretensao_max, modelo_trabalho, interesses")
        .eq("conta_id", conta.id)
        .maybeSingle(),
      admin
        .from("candidato_contas")
        .select(
          "cv_storage_path, cv_nome_arquivo, cv_gerado, cv_atualizado_em, nome, celular, endereco, visivel_pool",
        )
        .eq("id", conta.id)
        .maybeSingle(),
      admin
        .from("conta_formacoes")
        .select("id, titulo, instituicao, ano, status, origem")
        .eq("conta_id", conta.id)
        .order("created_at", { ascending: false }),
    ]);
    return {
      dados: {
        nome: contaCv?.data?.nome ?? conta.nome ?? null,
        email: conta.email,
        celular: contaCv?.data?.celular ?? null,
        endereco: contaCv?.data?.endereco ?? null,
      },
      formacoes: forms?.data ?? [],
      visivel_pool: contaCv?.data?.visivel_pool === true,
      cv: {
        tem_arquivo: !!contaCv?.data?.cv_storage_path,
        nome_arquivo: contaCv?.data?.cv_nome_arquivo ?? null,
        tem_gerado: !!contaCv?.data?.cv_gerado,
        atualizado_em: contaCv?.data?.cv_atualizado_em ?? null,
      },
      respostas: perfil?.data?.respostas ?? {},
      resumo_ia: perfil?.data?.resumo_ia ?? null,
      estruturado_em: perfil?.data?.estruturado_em ?? null,
      competencias: comps?.data ?? [],
      experiencias: exps?.data ?? [],
      preferencias: prefs?.data ?? null,
    };
  });

/** Salva as respostas abertas do perfil (as 4 perguntas). */
export const salvarRespostasPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SalvarRespostas.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("conta_perfil")
      .upsert(
        { conta_id: conta.id, respostas: data.respostas, updated_at: new Date().toISOString() },
        { onConflict: "conta_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Estrutura o perfil com IA: respostas abertas (+ material das candidaturas
 * vinculadas, lido internamente) → competências ancoradas na taxonomia GLOBAL
 * + experiências com VALIDAÇÃO (confiança, consistência com CV, pendências).
 * Prompt NEUTRO — nenhuma vaga/empresa é citada.
 */
export const estruturarMeuPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: perfil } = await admin
      .from("conta_perfil")
      .select("respostas")
      .eq("conta_id", conta.id)
      .maybeSingle();
    const respostas = perfil?.respostas ?? {};
    const temResposta = CHAVES_RESPOSTAS.some((k) => String(respostas[k] ?? "").trim().length > 0);

    // Material complementar: CV/experiência das candidaturas vinculadas (interno).
    const { data: cands } = await admin
      .from("candidatos_televendas")
      .select("cv_analise, experiencia_texto, setor_atual")
      .eq("conta_id", conta.id);
    const materialCv = (cands ?? [])
      .map((c: any) => ({ analise: c.cv_analise, exp: c.experiencia_texto, setor: c.setor_atual }))
      .filter((c: any) => c.analise || c.exp);
    // CV enviado na CONTA (neutro): vira bloco multimodal para a IA.
    const { data: contaCv } = await admin
      .from("candidato_contas")
      .select("cv_storage_path, cv_nome_arquivo")
      .eq("id", conta.id)
      .maybeSingle();
    let blocosCv: any[] = [];
    if (contaCv?.cv_storage_path) {
      const { data: file } = await admin.storage
        .from("curriculos")
        .download(contaCv.cv_storage_path);
      if (file) {
        const { extrairConteudoCv } = await import("@/lib/curriculo.functions");
        const ext = String(contaCv.cv_nome_arquivo ?? contaCv.cv_storage_path).toLowerCase();
        const mime = ext.endsWith(".pdf")
          ? "application/pdf"
          : /\.(jpe?g|png|webp)$/.test(ext)
            ? "image/" + (ext.endsWith(".png") ? "png" : ext.endsWith(".webp") ? "webp" : "jpeg")
            : ext.endsWith(".docx")
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "";
        blocosCv = await extrairConteudoCv(await file.arrayBuffer(), mime, ext);
      }
    }
    if (!temResposta && materialCv.length === 0 && blocosCv.length === 0) {
      throw new Error(
        "Responda pelo menos uma pergunta do perfil (ou envie um currículo) antes de organizar com IA.",
      );
    }

    // Taxonomia GLOBAL apenas (perfil é da plataforma, não de uma empresa).
    const { data: tax } = await admin
      .from("competencias")
      .select("id, nome, tipo")
      .eq("ativo", true)
      .is("empresa_id", null);
    const taxonomia: { id: string; nome: string; tipo: string }[] = tax ?? [];
    if (!taxonomia.length) throw new Error("Taxonomia de competências indisponível.");
    const lista = taxonomia.map((t) => `${t.nome} (${t.tipo})`).join("; ");

    const { callClaude } = await import("@/lib/recrutamento.functions");
    const out: any = await callClaude([
      ...blocosCv,
      {
        type: "text",
        text: `Você é analista de carreiras montando o PERFIL PROFISSIONAL NEUTRO de uma pessoa (sem nenhuma vaga em vista — proibido mencionar vagas ou empresas contratantes). Fontes: respostas dela em linguagem livre e, quando houver, material do currículo.

Responda SOMENTE com JSON válido, sem markdown:
{"resumo":"2-3 frases sobre o perfil profissional, tom respeitoso e simples","dados":{"nome":null,"celular":null,"endereco":null},"respostas_sugeridas":{"sei_fazer":null,"historia_trabalho":null,"interesses":null,"preferencias_texto":null},"formacoes":[{"titulo":"ex.: Ensino médio completo | Técnico em X","instituicao":null,"ano":null,"status":"concluido|cursando|incompleto"}],"competencias":[{"nome":"<EXATAMENTE um nome da LISTA>","nivel":3,"confianca":0.7}],"experiencias":[{"tipo":"formal|informal|voluntariado|projeto|curso","titulo":"","organizacao":"","descricao":"","confianca":0.8,"status_validacao":"consistente_cv|pendente_confirmacao","pendencia":null}]}

REGRAS dos "dados": só o que estiver ESCRITO no material (currículo/respostas) — nunca invente; ausente = null. "endereco" = bairro/cidade. REGRAS das "respostas_sugeridas": rascunho em 1ª PESSOA, tom simples e natural (como a própria pessoa contaria), 2-4 frases cada, montado SÓ com o que está no currículo — "sei_fazer" (o que ela sabe fazer bem), "historia_trabalho" (onde trabalhou/estudou), "interesses" (áreas que os dados sugerem), "preferencias_texto" (só se o material indicar; senão null). Sem informação suficiente = null. REGRAS das "formacoes": escolaridade e cursos formais (ensino fundamental/médio/técnico/superior) — cursos livres curtos podem ir em experiencias tipo "curso".
REGRAS DE VALIDAÇÃO das experiências: "consistente_cv" só quando a experiência declarada bate com o material do currículo; senão "pendente_confirmacao" com "pendencia" em linguagem simples e acolhedora dizendo o que confirmar ou anexar (ex.: "Confirme quanto tempo você ficou nesse trabalho" ou "Se tiver, anexe uma foto do certificado"). Trabalho informal/bico/voluntariado VALE como experiência (tipo adequado) — nunca desqualifique. Não invente experiências nem competências. Use SOMENTE nomes exatos da LISTA de competências. Máximo 10 competências e 8 experiências.

LISTA DE COMPETÊNCIAS: ${lista}

RESPOSTAS DA PESSOA:
- O que sei fazer: ${String(respostas.sei_fazer ?? "").slice(0, 2000)}
- Onde já trabalhei/estudei: ${String(respostas.historia_trabalho ?? "").slice(0, 2000)}
- O que me interessa: ${String(respostas.interesses ?? "").slice(0, 2000)}
- Como prefiro trabalhar: ${String(respostas.preferencias_texto ?? "").slice(0, 2000)}

MATERIAL DO CURRÍCULO (quando houver):
${JSON.stringify(materialCv).slice(0, 6000)}`,
      },
    ]);

    // Competências: ancoradas por nome; IA não rebaixa o que a pessoa declarou à mão.
    const byName = new Map(taxonomia.map((t) => [t.nome, t.id]));
    const compRows = (out?.competencias ?? [])
      .filter((x: any) => x?.nome && byName.has(x.nome))
      .map((x: any) => ({
        conta_id: conta.id,
        competencia_id: byName.get(x.nome),
        nivel: Math.min(5, Math.max(1, Math.round(x.nivel ?? 3))),
        origem: "ia",
        confianca: typeof x.confianca === "number" ? Math.min(1, Math.max(0, x.confianca)) : null,
      }));
    const { data: manuais } = await admin
      .from("conta_competencias")
      .select("competencia_id")
      .eq("conta_id", conta.id)
      .eq("origem", "declarada");
    const manuaisSet = new Set((manuais ?? []).map((m: any) => m.competencia_id));
    const novas = compRows.filter((r: any) => !manuaisSet.has(r.competencia_id));
    if (novas.length) {
      const { error } = await admin
        .from("conta_competencias")
        .upsert(novas, { onConflict: "conta_id,competencia_id" });
      if (error) throw new Error(error.message);
    }

    // Experiências: substitui as de origem IA, preserva as manuais.
    await admin.from("conta_experiencias").delete().eq("conta_id", conta.id).eq("origem", "ia");
    const expRows = (out?.experiencias ?? [])
      .filter((x: any) => x?.titulo)
      .slice(0, 8)
      .map((x: any) => ({
        conta_id: conta.id,
        tipo: ["formal", "informal", "voluntariado", "projeto", "curso"].includes(x.tipo)
          ? x.tipo
          : "formal",
        titulo: String(x.titulo).slice(0, 200),
        organizacao: x.organizacao ? String(x.organizacao).slice(0, 200) : null,
        descricao: x.descricao ? String(x.descricao).slice(0, 800) : null,
        origem: "ia",
        confianca: typeof x.confianca === "number" ? Math.min(1, Math.max(0, x.confianca)) : null,
        status_validacao:
          x.status_validacao === "consistente_cv" ? "consistente_cv" : "pendente_confirmacao",
        pendencia: x.pendencia ? String(x.pendencia).slice(0, 300) : null,
      }));
    if (expRows.length) {
      const { error } = await admin.from("conta_experiencias").insert(expRows);
      if (error) throw new Error(error.message);
    }

    // Dados pessoais: preenche SÓ o que está vazio na conta (nunca sobrescreve).
    const dadosIa = out?.dados ?? {};
    const { data: contaAtual } = await admin
      .from("candidato_contas")
      .select("nome, celular, endereco")
      .eq("id", conta.id)
      .maybeSingle();
    const patchDados: Record<string, string> = {};
    if (!contaAtual?.nome && dadosIa.nome) patchDados.nome = String(dadosIa.nome).slice(0, 200);
    if (!contaAtual?.celular && dadosIa.celular)
      patchDados.celular = String(dadosIa.celular).slice(0, 40);
    if (!contaAtual?.endereco && dadosIa.endereco)
      patchDados.endereco = String(dadosIa.endereco).slice(0, 300);
    if (Object.keys(patchDados).length) {
      await admin.from("candidato_contas").update(patchDados).eq("id", conta.id);
    }

    // Formações: substitui as de origem IA, preserva as manuais.
    await admin.from("conta_formacoes").delete().eq("conta_id", conta.id).eq("origem", "ia");
    const formRows = (out?.formacoes ?? [])
      .filter((f: any) => f?.titulo)
      .slice(0, 6)
      .map((f: any) => ({
        conta_id: conta.id,
        titulo: String(f.titulo).slice(0, 200),
        instituicao: f.instituicao ? String(f.instituicao).slice(0, 200) : null,
        ano: f.ano ? String(f.ano).slice(0, 20) : null,
        status: ["cursando", "concluido", "incompleto"].includes(f.status) ? f.status : "concluido",
        origem: "ia",
      }));
    if (formRows.length) {
      await admin.from("conta_formacoes").insert(formRows);
    }

    // Respostas abertas: o rascunho da IA preenche SÓ pergunta vazia — o que a
    // pessoa escreveu com as próprias palavras nunca é sobrescrito.
    const sugeridas = out?.respostas_sugeridas ?? {};
    const respostasFinais: Record<string, string> = { ...respostas };
    for (const k of CHAVES_RESPOSTAS) {
      if (!String(respostasFinais[k] ?? "").trim() && sugeridas[k]) {
        respostasFinais[k] = String(sugeridas[k]).slice(0, 2000);
      }
    }

    await admin.from("conta_perfil").upsert(
      {
        conta_id: conta.id,
        respostas: respostasFinais,
        resumo_ia: out?.resumo ? String(out.resumo).slice(0, 600) : null,
        estruturado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "conta_id" },
    );
    return { ok: true, competencias: novas.length, experiencias: expRows.length };
  });

// CRUD manual do perfil (espelha as fns por-candidatura).
const CompConta = z.object({
  competencia_id: z.string().uuid(),
  nivel: z.number().int().min(1).max(5),
});
export const salvarMinhaCompetenciaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CompConta.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("conta_competencias").upsert(
      {
        conta_id: conta.id,
        competencia_id: data.competencia_id,
        nivel: data.nivel,
        origem: "declarada",
      },
      { onConflict: "conta_id,competencia_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const IdSo = z.object({ id: z.string().uuid() });
export const removerMinhaCompetenciaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSo.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("conta_competencias")
      .delete()
      .eq("id", data.id)
      .eq("conta_id", conta.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ExpConta = z.object({
  id: z.string().uuid().optional(),
  tipo: z.enum(["formal", "informal", "voluntariado", "projeto", "curso"]),
  titulo: z.string().min(1).max(200),
  organizacao: z.string().max(200).optional().nullable(),
  inicio: z.string().optional().nullable(),
  fim: z.string().optional().nullable(),
  atual: z.boolean().default(false),
  descricao: z.string().max(800).optional().nullable(),
});
export const salvarExperienciaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExpConta.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const row = {
      tipo: data.tipo,
      titulo: data.titulo,
      organizacao: data.organizacao ?? null,
      inicio: data.inicio || null,
      fim: data.fim || null,
      atual: data.atual,
      descricao: data.descricao ?? null,
      origem: "declarada",
      status_validacao: "declarada",
    };
    const { error } = data.id
      ? await admin
          .from("conta_experiencias")
          .update(row)
          .eq("id", data.id)
          .eq("conta_id", conta.id)
      : await admin.from("conta_experiencias").insert({ ...row, conta_id: conta.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerExperienciaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSo.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("conta_experiencias")
      .delete()
      .eq("id", data.id)
      .eq("conta_id", conta.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const PrefsConta = z.object({
  disponibilidade: z.string().max(200).optional().nullable(),
  pretensao_min: z.number().optional().nullable(),
  pretensao_max: z.number().optional().nullable(),
  modelo_trabalho: z.enum(["presencial", "hibrido", "remoto", "indiferente"]).optional().nullable(),
  interesses: z.array(z.string().max(80)).max(20).default([]),
});
export const salvarPreferenciasConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PrefsConta.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("conta_preferencias")
      .upsert(
        { conta_id: conta.id, ...data, updated_at: new Date().toISOString() },
        { onConflict: "conta_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * PROJEÇÃO conta → candidatura: copia o perfil neutro para as tabelas da
 * candidatura (o que o motor de match atual consome). Nunca sobrescreve
 * avaliações do staff (origem 'avaliada').
 */
export const aplicarPerfilNaCandidatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandId.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const cand = await assertDonoCandidatura(conta, data.candidatoId);
    const empresaId = await resolverEmpresaDaCandidatura(cand);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [comps, exps, prefs, jaComps, jaExps] = await Promise.all([
      admin
        .from("conta_competencias")
        .select("competencia_id, nivel, origem, confianca")
        .eq("conta_id", conta.id),
      admin
        .from("conta_experiencias")
        .select("tipo, titulo, organizacao, inicio, fim, atual, descricao")
        .eq("conta_id", conta.id),
      admin
        .from("conta_preferencias")
        .select("disponibilidade, pretensao_min, pretensao_max, modelo_trabalho, interesses")
        .eq("conta_id", conta.id)
        .maybeSingle(),
      admin
        .from("candidato_competencias")
        .select("competencia_id, origem")
        .eq("candidato_id", cand.id),
      admin.from("candidato_experiencias").select("titulo").eq("candidato_id", cand.id),
    ]);

    // Competências: não tocar nas avaliadas pelo staff.
    const avaliadas = new Set(
      (jaComps?.data ?? [])
        .filter((c: any) => c.origem === "avaliada")
        .map((c: any) => c.competencia_id),
    );
    const compRows = (comps?.data ?? [])
      .filter((c: any) => !avaliadas.has(c.competencia_id))
      .map((c: any) => ({
        candidato_id: cand.id,
        competencia_id: c.competencia_id,
        nivel: c.nivel,
        origem: c.origem === "ia" ? "ia" : "declarada",
        confianca: c.confianca,
      }));
    if (compRows.length) {
      const { error } = await admin
        .from("candidato_competencias")
        .upsert(compRows, { onConflict: "candidato_id,competencia_id" });
      if (error) throw new Error(error.message);
    }

    // Experiências: só títulos ainda ausentes (sem duplicar).
    const titulos = new Set((jaExps?.data ?? []).map((e: any) => String(e.titulo).toLowerCase()));
    const expRows = (exps?.data ?? [])
      .filter((e: any) => !titulos.has(String(e.titulo).toLowerCase()))
      .map((e: any) => ({ ...e, candidato_id: cand.id }));
    if (expRows.length) {
      const { error } = await admin.from("candidato_experiencias").insert(expRows);
      if (error) throw new Error(error.message);
    }

    if (prefs?.data) {
      await admin
        .from("candidato_preferencias")
        .upsert({ candidato_id: cand.id, ...prefs.data }, { onConflict: "candidato_id" });
    }

    await registrarAlteracao(
      cand.id,
      empresaId,
      "perfil",
      null,
      "perfil da conta aplicado pelo titular",
    );
    return { ok: true, competencias: compRows.length, experiencias: expRows.length };
  });

// ==================== 19. Currículo na Conta ====================
// Dois caminhos: quem TEM currículo envia (e o perfil nasce preenchido);
// quem NÃO TEM cria um a partir do próprio perfil (com download em PDF).

const EnviarCvConta = z.object({
  storagePath: z.string().min(5).max(400),
  nomeArquivo: z.string().min(1).max(200),
});
/** Registra o CV enviado na conta (upload client-side em conta/<id>/...). */
export const enviarMeuCurriculoConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EnviarCvConta.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const prefixo = `conta/${conta.id}/`;
    if (!data.storagePath.startsWith(prefixo) || data.storagePath.includes("..")) {
      throw new Error("Caminho de arquivo inválido.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    // Substitui o anterior (arquivo antigo sai do bucket).
    const { data: atual } = await admin
      .from("candidato_contas")
      .select("cv_storage_path")
      .eq("id", conta.id)
      .maybeSingle();
    if (atual?.cv_storage_path && atual.cv_storage_path !== data.storagePath) {
      await admin.storage
        .from("curriculos")
        .remove([atual.cv_storage_path])
        .catch(() => {});
    }
    const { error } = await admin
      .from("candidato_contas")
      .update({
        cv_storage_path: data.storagePath,
        cv_nome_arquivo: data.nomeArquivo,
        cv_atualizado_em: new Date().toISOString(),
      })
      .eq("id", conta.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** URL assinada e curta (90s) do CV da conta. */
export const urlMeuCurriculoConta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: c } = await admin
      .from("candidato_contas")
      .select("cv_storage_path")
      .eq("id", conta.id)
      .maybeSingle();
    if (!c?.cv_storage_path) throw new Error("Você ainda não enviou um currículo.");
    const { data: signed, error } = await admin.storage
      .from("curriculos")
      .createSignedUrl(c.cv_storage_path, 90);
    if (error || !signed?.signedUrl) throw new Error("Não foi possível gerar o link.");
    return { url: signed.signedUrl };
  });

/** Remove o CV da conta (arquivo + colunas). */
export const removerMeuCurriculoConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: c } = await admin
      .from("candidato_contas")
      .select("cv_storage_path")
      .eq("id", conta.id)
      .maybeSingle();
    if (c?.cv_storage_path) {
      await admin.storage
        .from("curriculos")
        .remove([c.cv_storage_path])
        .catch(() => {});
    }
    const { error } = await admin
      .from("candidato_contas")
      .update({
        cv_storage_path: null,
        cv_nome_arquivo: null,
        cv_atualizado_em: new Date().toISOString(),
      })
      .eq("id", conta.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Gera um currículo apresentável a partir do PERFIL (para quem não tem).
 * Honesto por construção: a IA usa SOMENTE o que está no perfil — nunca inventa.
 */
export const gerarMeuCurriculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [perfil, comps, exps, prefs, forms, contaFull] = await Promise.all([
      admin
        .from("conta_perfil")
        .select("respostas, resumo_ia")
        .eq("conta_id", conta.id)
        .maybeSingle(),
      admin
        .from("conta_competencias")
        .select("nivel, competencia:competencias(nome, tipo)")
        .eq("conta_id", conta.id),
      admin
        .from("conta_experiencias")
        .select("tipo, titulo, organizacao, inicio, fim, atual, descricao, status_validacao")
        .eq("conta_id", conta.id),
      admin
        .from("conta_preferencias")
        .select("disponibilidade, modelo_trabalho, interesses")
        .eq("conta_id", conta.id)
        .maybeSingle(),
      admin
        .from("conta_formacoes")
        .select("titulo, instituicao, ano, status")
        .eq("conta_id", conta.id),
      admin.from("candidato_contas").select("celular, endereco").eq("id", conta.id).maybeSingle(),
    ]);

    const temMaterial =
      (comps?.data ?? []).length > 0 ||
      (exps?.data ?? []).length > 0 ||
      Object.values(perfil?.data?.respostas ?? {}).some((v: any) => String(v ?? "").trim());
    if (!temMaterial) {
      throw new Error(
        "Seu perfil ainda está vazio — responda sua história primeiro (e organize com IA).",
      );
    }

    const { callClaude } = await import("@/lib/recrutamento.functions");
    const out: any = await callClaude([
      {
        type: "text",
        text: `Você é um redator de currículos acessível e honesto. Monte um currículo em português do Brasil a partir SOMENTE do material abaixo — NUNCA invente empregos, datas, formações ou habilidades que não estejam no material. Linguagem simples e profissional; trabalho informal/bico/voluntariado é experiência legítima e deve aparecer com dignidade.

Responda SOMENTE com JSON válido, sem markdown:
{"objetivo":"1 frase com o objetivo profissional (baseado nos interesses; genérico se não houver)","resumo":"2-3 frases de apresentação","experiencias":[{"titulo":"","organizacao":"","periodo":"","descricao":"1-2 frases"}],"formacao":["itens de estudo/curso, se houver"],"habilidades":["nomes das competências"]}

MATERIAL:
- Nome: ${conta.nome ?? ""}
- Respostas do perfil: ${JSON.stringify(perfil?.data?.respostas ?? {}).slice(0, 4000)}
- Resumo já organizado: ${perfil?.data?.resumo_ia ?? ""}
- Competências: ${JSON.stringify((comps?.data ?? []).map((c: any) => ({ nome: c.competencia?.nome, nivel: c.nivel }))).slice(0, 2000)}
- Experiências: ${JSON.stringify(exps?.data ?? []).slice(0, 4000)}
- Formações: ${JSON.stringify(forms?.data ?? []).slice(0, 1500)}
- Preferências: ${JSON.stringify(prefs?.data ?? {}).slice(0, 800)}`,
      },
    ]);

    const cvGerado = {
      cabecalho: {
        nome: conta.nome ?? "",
        email: conta.email,
        celular: (contaFull?.data?.celular ?? null) as string | null,
        endereco: (contaFull?.data?.endereco ?? null) as string | null,
      },
      objetivo: out?.objetivo ? String(out.objetivo).slice(0, 300) : null,
      resumo: out?.resumo ? String(out.resumo).slice(0, 600) : null,
      experiencias: Array.isArray(out?.experiencias) ? out.experiencias.slice(0, 10) : [],
      formacao: Array.isArray(out?.formacao) ? out.formacao.slice(0, 8) : [],
      habilidades: Array.isArray(out?.habilidades) ? out.habilidades.slice(0, 15) : [],
    };
    const { data: umaCand } = await admin
      .from("candidatos_televendas")
      .select("celular")
      .eq("conta_id", conta.id)
      .limit(1)
      .maybeSingle();
    if (umaCand?.celular) cvGerado.cabecalho.celular = umaCand.celular;

    const { error } = await admin
      .from("candidato_contas")
      .update({ cv_gerado: cvGerado, cv_atualizado_em: new Date().toISOString() })
      .eq("id", conta.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Currículo gerado do titular (para a página /portal/curriculo). */
export const getMeuCurriculoGerado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await (supabaseAdmin as any)
      .from("candidato_contas")
      .select("cv_gerado, cv_atualizado_em")
      .eq("id", conta.id)
      .maybeSingle();
    return { cv: c?.cv_gerado ?? null, atualizado_em: c?.cv_atualizado_em ?? null };
  });

// ============ 20. Dados pessoais e formação do perfil (v2) ============

const DadosConta = z.object({
  nome: z.string().min(1).max(200),
  celular: z.string().max(40).optional().nullable(),
  endereco: z.string().max(300).optional().nullable(),
});
export const salvarMeusDadosConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DadosConta.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("candidato_contas")
      .update({ nome: data.nome, celular: data.celular ?? null, endereco: data.endereco ?? null })
      .eq("id", conta.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const FormacaoConta = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(1).max(200),
  instituicao: z.string().max(200).optional().nullable(),
  ano: z.string().max(20).optional().nullable(),
  status: z.enum(["cursando", "concluido", "incompleto"]).default("concluido"),
});
export const salvarFormacaoConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FormacaoConta.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const row = {
      titulo: data.titulo,
      instituicao: data.instituicao ?? null,
      ano: data.ano ?? null,
      status: data.status,
      origem: "declarada",
    };
    const { error } = data.id
      ? await admin.from("conta_formacoes").update(row).eq("id", data.id).eq("conta_id", conta.id)
      : await admin.from("conta_formacoes").insert({ ...row, conta_id: conta.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerFormacaoConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSo.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("conta_formacoes")
      .delete()
      .eq("id", data.id)
      .eq("conta_id", conta.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ 21. Convites (modelo empresa-puxa) ============
// A empresa encontra o fit no pool e convida; o candidato decide aqui.
// O aceite CRIA a candidatura (com os dados da conta) e projeta o perfil.

const VisibilidadeInput = z.object({ visivel: z.boolean() });
export const setMinhaVisibilidadePool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VisibilidadeInput.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("candidato_contas")
      .update({ visivel_pool: data.visivel })
      .eq("id", conta.id);
    if (error) throw new Error(error.message);
    return { ok: true, visivel: data.visivel };
  });

export const listarMeusConvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: convites } = await admin
      .from("convites")
      .select(
        "id, status, mensagem, created_at, respondido_em, candidato_id, vaga:vagas(id, titulo, setor), empresa:empresas(nome, logo_path, cor_primaria)",
      )
      .eq("conta_id", conta.id)
      .neq("status", "cancelado")
      .order("created_at", { ascending: false })
      .limit(30);
    return { convites: convites ?? [] };
  });

const ResponderConviteInput = z.object({
  conviteId: z.string().uuid(),
  aceitar: z.boolean(),
});
export const responderConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResponderConviteInput.parse(d))
  .handler(async ({ data, context }) => {
    const conta = await carregarConta((context as any).userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: convite } = await admin
      .from("convites")
      .select("id, vaga_id, empresa_id, status")
      .eq("id", data.conviteId)
      .eq("conta_id", conta.id)
      .maybeSingle();
    if (!convite) throw new Error("Convite não encontrado.");
    if (convite.status !== "pendente") throw new Error("Este convite já foi respondido.");

    if (!data.aceitar) {
      await admin
        .from("convites")
        .update({ status: "recusado", respondido_em: new Date().toISOString() })
        .eq("id", convite.id);
      return { ok: true, aceito: false };
    }

    // Aceite: os dados da conta viram a candidatura (aqui SIM a empresa
    // passa a ver nome/contato — é o consentimento do titular).
    const { data: contaFull } = await admin
      .from("candidato_contas")
      .select("nome, email, celular, endereco, cv_storage_path, cv_nome_arquivo")
      .eq("id", conta.id)
      .maybeSingle();
    if (!contaFull?.nome || !contaFull?.celular) {
      throw new Error(
        "Complete seu nome e celular em Meu perfil antes de aceitar (a empresa precisa falar com você).",
      );
    }
    const { data: vaga } = await admin
      .from("vagas")
      .select("id, empresa_id, unidade_id")
      .eq("id", convite.vaga_id)
      .maybeSingle();
    if (!vaga) throw new Error("A vaga deste convite não existe mais.");

    const { data: jaCand } = await admin
      .from("candidatos_televendas")
      .select("id")
      .eq("conta_id", conta.id)
      .eq("vaga_id", vaga.id)
      .maybeSingle();
    let candidatoId = jaCand?.id as string | undefined;
    if (!candidatoId) {
      candidatoId = crypto.randomUUID();
      const { error: insErr } = await admin.from("candidatos_televendas").insert({
        id: candidatoId,
        vaga_id: vaga.id,
        empresa_id: vaga.empresa_id,
        unidade_id: vaga.unidade_id ?? null,
        conta_id: conta.id,
        nome: contaFull.nome,
        email: contaFull.email,
        celular: contaFull.celular,
        endereco: contaFull.endereco ?? null,
        lgpd_aceite: true,
      });
      if (insErr) throw new Error(insErr.message);
    }
    await admin
      .from("convites")
      .update({
        status: "aceito",
        candidato_id: candidatoId,
        respondido_em: new Date().toISOString(),
      })
      .eq("id", convite.id);
    await registrarAlteracao(candidatoId, vaga.empresa_id ?? null, "convite", null, "aceito").catch(
      () => {},
    );
    return { ok: true, aceito: true, candidatoId };
  });
