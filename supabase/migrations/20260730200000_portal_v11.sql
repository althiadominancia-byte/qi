-- Portal do Candidato v1.1: evidências (bucket + acesso do titular) e
-- contestação/revisão humana (LGPD art. 20).

-- ============= 1. Bucket privado de evidências =============
-- Path: <empresa_id>/<candidato_id>/<uuid>.<ext>
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias', 'evidencias', false)
ON CONFLICT (id) DO NOTHING;

-- Titular: candidatura possuída (conta_id = auth.uid()) na 2ª pasta do path,
-- com a empresa correta na 1ª pasta.
CREATE OR REPLACE FUNCTION public.evidencia_path_do_titular(_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidatos_televendas c
    WHERE c.id::text = (storage.foldername(_name))[2]
      AND c.conta_id = auth.uid()
      AND c.empresa_id::text = (storage.foldername(_name))[1]
  );
$$;

DROP POLICY IF EXISTS "evidencias titular escreve" ON storage.objects;
CREATE POLICY "evidencias titular escreve"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'evidencias' AND public.evidencia_path_do_titular(name));

DROP POLICY IF EXISTS "evidencias titular remove" ON storage.objects;
CREATE POLICY "evidencias titular remove"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'evidencias' AND public.evidencia_path_do_titular(name));

-- Leitura: titular OU staff da empresa (mesmo padrão do bucket curriculos).
DROP POLICY IF EXISTS "evidencias leitura" ON storage.objects;
CREATE POLICY "evidencias leitura"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidencias'
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

-- ============= 2. Contestação / revisão humana (LGPD art. 20) =============
CREATE TABLE IF NOT EXISTS public.candidato_revisoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id   uuid NOT NULL REFERENCES public.candidatos_televendas(id) ON DELETE CASCADE,
  conta_id       uuid REFERENCES public.candidato_contas(id) ON DELETE SET NULL,
  empresa_id     uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  mensagem       text NOT NULL,
  status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','respondida')),
  resposta       text,
  respondido_por uuid,
  respondido_em  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cand_revisoes_candidato ON public.candidato_revisoes(candidato_id);
CREATE INDEX IF NOT EXISTS idx_cand_revisoes_empresa ON public.candidato_revisoes(empresa_id, status);

ALTER TABLE public.candidato_revisoes ENABLE ROW LEVEL SECURITY;

-- Titular lê as próprias solicitações.
DROP POLICY IF EXISTS "revisoes titular le" ON public.candidato_revisoes;
CREATE POLICY "revisoes titular le"
ON public.candidato_revisoes FOR SELECT TO authenticated
USING (conta_id = auth.uid());

-- Staff lê/responde no escopo da empresa (mesma regra dos candidatos).
DROP POLICY IF EXISTS "revisoes staff le" ON public.candidato_revisoes;
CREATE POLICY "revisoes staff le"
ON public.candidato_revisoes FOR SELECT TO authenticated
USING (
  (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, NULL::uuid))
  AND public.user_has_perm('ver_candidatos')
);

DROP POLICY IF EXISTS "revisoes staff responde" ON public.candidato_revisoes;
CREATE POLICY "revisoes staff responde"
ON public.candidato_revisoes FOR UPDATE TO authenticated
USING (
  (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, NULL::uuid))
  AND public.user_has_perm('ver_candidatos')
)
WITH CHECK (
  (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, NULL::uuid))
  AND public.user_has_perm('ver_candidatos')
);
-- INSERT: sem policy — só service-role (server fn do portal com owner-check).
