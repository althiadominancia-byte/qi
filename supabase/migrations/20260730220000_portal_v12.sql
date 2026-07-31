-- Portal v1.2: vídeo-pitch do candidato (gravação solo + análise de conteúdo).
-- O currículo→pré-preenchimento não precisa de schema (usa bucket curriculos).

-- ============= 1. Bucket privado de vídeos =============
-- Path: <empresa_id>/<candidato_id>/pitch-<uuid>.webm — mesma convenção das
-- evidências, então as policies REUTILIZAM evidencia_path_do_titular().
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "videos titular escreve" ON storage.objects;
CREATE POLICY "videos titular escreve"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'videos' AND public.evidencia_path_do_titular(name));

DROP POLICY IF EXISTS "videos titular remove" ON storage.objects;
CREATE POLICY "videos titular remove"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'videos' AND public.evidencia_path_do_titular(name));

DROP POLICY IF EXISTS "videos leitura" ON storage.objects;
CREATE POLICY "videos leitura"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'videos'
  AND (
    public.evidencia_path_do_titular(name)
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.ativo
        AND (u.empresa_id)::text = (storage.foldername(name))[1]
    )
  )
);

-- ============= 2. Registro do vídeo-pitch =============
-- transcricao/analise são INTERNAS (staff) — o titular vê só o próprio vídeo.
-- Retenção: entra no cron de limpeza junto das entrevistas (backlog).
CREATE TABLE IF NOT EXISTS public.candidato_videos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id  uuid NOT NULL REFERENCES public.candidatos_televendas(id) ON DELETE CASCADE,
  empresa_id    uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  duracao_s     integer,
  versao_termo  text NOT NULL,
  consentiu_em  timestamptz NOT NULL,
  aceite_ip     text,
  transcricao   text,
  analise       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cand_videos_candidato ON public.candidato_videos(candidato_id);

ALTER TABLE public.candidato_videos ENABLE ROW LEVEL SECURITY;

-- Staff lê no escopo (transcrição/análise são apoio à decisão HUMANA).
DROP POLICY IF EXISTS "videos staff le" ON public.candidato_videos;
CREATE POLICY "videos staff le"
ON public.candidato_videos FOR SELECT TO authenticated
USING (
  (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, NULL::uuid))
  AND public.user_has_perm('ver_candidatos')
);
-- Titular acessa exclusivamente via server fns (service-role + owner-check).

-- ============= 3. Feature key video_pitch nos planos =============
UPDATE public.planos SET features = features || '{"video_pitch": false}'::jsonb
WHERE id = '00000000-0000-0000-0002-000000000001' AND NOT (features ? 'video_pitch');
UPDATE public.planos SET features = features || '{"video_pitch": true}'::jsonb
WHERE id IN ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0002-000000000003')
  AND NOT (features ? 'video_pitch');
