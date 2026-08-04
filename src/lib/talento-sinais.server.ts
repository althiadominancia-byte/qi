// CONTRATO portal ↔ motor (server-only) — divisão de trabalho de 2026-08-04.
//
// O motor (jornada.functions.ts / qinmatch) importa DAQUI os sinais de
// completude do talento e da candidatura, sem duplicar leitura de tabelas:
//
//  - sinaisDoTalento(contaId): nível CONTA — vídeo/CV são do talento e valem
//    para TODAS as empresas (vídeo: candidato_videos.conta_id).
//  - sinaisDaCandidatura(candidatoId): nível CANDIDATURA (per-vaga) — inclui
//    DISC/situacional (que são por vaga) e herda CV/vídeo da conta vinculada.
//  - `visivel_pool` (candidato_contas) é o opt-in de descobribilidade: o
//    ranking do motor DEVE filtrar por ele (a listagem do pool já filtra).
//  - convites.match_score: o MOTOR escreve (status 'sugerido'); o portal só lê.
//
// Regra de completude (dono, 2026-08-04): perfil completo = dados + currículo
// + DISC + situacional (se aplicável) + vídeo. Decisão NUNCA é automática
// (LGPD art. 20) — sinais servem para gating de etapa e badge, não para cortar.

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type SinaisTalento = {
  tem_dados: boolean; // nome + celular + email na conta
  tem_cv: boolean; // arquivo OU currículo gerado na conta
  tem_video: boolean; // vídeo-pitch em nível de conta (reutilizável)
  visivel_pool: boolean;
};

export async function sinaisDoTalento(contaId: string): Promise<SinaisTalento> {
  const db = await admin();
  const [{ data: conta }, { data: video }] = await Promise.all([
    db
      .from("candidato_contas")
      .select("nome, email, celular, cv_storage_path, cv_gerado, visivel_pool")
      .eq("id", contaId)
      .maybeSingle(),
    db.from("candidato_videos").select("id").eq("conta_id", contaId).limit(1).maybeSingle(),
  ]);
  return {
    tem_dados: !!conta?.nome && !!conta?.email && !!conta?.celular,
    tem_cv: !!conta?.cv_storage_path || !!conta?.cv_gerado,
    tem_video: !!video,
    visivel_pool: conta?.visivel_pool === true,
  };
}

export type SinaisCandidatura = SinaisTalento & {
  conta_id: string | null;
  disc_feito: boolean;
  situacional_feito: boolean; // true também quando a vaga não usa situacional
};

export async function sinaisDaCandidatura(candidatoId: string): Promise<SinaisCandidatura> {
  const db = await admin();
  const { data: cand } = await db
    .from("candidatos_televendas")
    .select(
      "id, conta_id, vaga_id, nome, email, celular, cv_storage_path, disc_pontuacao, situacionais",
    )
    .eq("id", candidatoId)
    .maybeSingle();
  if (!cand) throw new Error("Candidatura não encontrada.");

  const [{ data: vaga }, { data: videoCand }, sinaisConta] = await Promise.all([
    cand.vaga_id
      ? db.from("vagas").select("usar_situacional, situacoes").eq("id", cand.vaga_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("candidato_videos").select("id").eq("candidato_id", cand.id).limit(1).maybeSingle(),
    cand.conta_id
      ? sinaisDoTalento(cand.conta_id)
      : Promise.resolve({
          tem_dados: false,
          tem_cv: false,
          tem_video: false,
          visivel_pool: false,
        } as SinaisTalento),
  ]);

  const situacionalAplicavel =
    vaga?.usar_situacional !== false &&
    (Array.isArray(vaga?.situacoes) ? vaga.situacoes.length > 0 : true);
  return {
    conta_id: cand.conta_id ?? null,
    // Dados/CV: o que a candidatura tem OU o que a conta do talento tem.
    tem_dados: (!!cand.nome && !!cand.email && !!cand.celular) || sinaisConta.tem_dados,
    tem_cv: !!cand.cv_storage_path || sinaisConta.tem_cv,
    // Vídeo: da candidatura OU da conta (reutilizável entre empresas).
    tem_video: !!videoCand || sinaisConta.tem_video,
    visivel_pool: sinaisConta.visivel_pool,
    disc_feito: !!cand.disc_pontuacao && Object.keys(cand.disc_pontuacao).length > 0,
    situacional_feito:
      !situacionalAplicavel || (!!cand.situacionais && Object.keys(cand.situacionais).length > 0),
  };
}
