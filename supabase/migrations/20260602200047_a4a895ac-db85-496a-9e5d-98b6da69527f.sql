
-- 1) diversidade_candidatos: restringir INSERT (precisa vincular a vaga aberta/empresa válida)
DROP POLICY IF EXISTS "div anon insere" ON public.diversidade_candidatos;
DROP POLICY IF EXISTS "div auth insere" ON public.diversidade_candidatos;

CREATE POLICY "div anon insere"
ON public.diversidade_candidatos
FOR INSERT TO anon
WITH CHECK (
  vaga_id IS NOT NULL
  AND empresa_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.vagas v
    LEFT JOIN public.empresas e ON e.id = v.empresa_id
    WHERE v.id = diversidade_candidatos.vaga_id
      AND v.empresa_id = diversidade_candidatos.empresa_id
      AND v.status = 'Aberta'
      AND COALESCE(v.formulario_aprovado, false)
      AND COALESCE(e.ativo, false)
  )
);

CREATE POLICY "div auth insere"
ON public.diversidade_candidatos
FOR INSERT TO authenticated
WITH CHECK (
  vaga_id IS NOT NULL
  AND empresa_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.vagas v
    WHERE v.id = diversidade_candidatos.vaga_id
      AND v.empresa_id = diversidade_candidatos.empresa_id
  )
);

-- 2) diversidade_candidatos: remover branch (empresa_id IS NULL) do SELECT scope
DROP POLICY IF EXISTS "div scope select" ON public.diversidade_candidatos;
CREATE POLICY "div scope select"
ON public.diversidade_candidatos
FOR SELECT
USING (
  user_has_perm('ver_diversidade')
  AND (
    is_super_admin()
    OR (empresa_id IS NOT NULL AND user_can_access_unidade(empresa_id, unidade_id))
  )
);

-- 3) Storage curriculos: restringir INSERT por path
DROP POLICY IF EXISTS "Anon upload curriculos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload curriculos" ON storage.objects;
DROP POLICY IF EXISTS "cv upload anon" ON storage.objects;
DROP POLICY IF EXISTS "cv upload auth" ON storage.objects;

-- Função para validar path de upload anônimo: <empresa_id>/<vaga_id>/...
CREATE OR REPLACE FUNCTION public.cv_path_valid_for_open_vaga(_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vagas v
    LEFT JOIN public.empresas e ON e.id = v.empresa_id
    WHERE (storage.foldername(_name))[1] = v.empresa_id::text
      AND (storage.foldername(_name))[2] = v.id::text
      AND v.status = 'Aberta'
      AND COALESCE(v.formulario_aprovado, false)
      AND COALESCE(e.ativo, false)
  );
$$;

CREATE POLICY "cv upload anon"
ON storage.objects
FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'curriculos'
  AND public.cv_path_valid_for_open_vaga(name)
);

CREATE POLICY "cv upload auth"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'curriculos'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.ativo
        AND (u.empresa_id)::text = (storage.foldername(name))[1]
    )
    OR public.cv_path_valid_for_open_vaga(name)
  )
);

-- 4) unidades: restringir leitura pública a usuários autenticados
DROP POLICY IF EXISTS "un anon lê" ON public.unidades;
CREATE POLICY "un auth lê ativas"
ON public.unidades
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = unidades.empresa_id AND e.ativo
  )
);
