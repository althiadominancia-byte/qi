-- Currículo na CONTA (neutro, sem vaga): o candidato envia o que tem OU cria
-- um do zero a partir do próprio perfil. Complemento do Cadastro Neutro.

ALTER TABLE public.candidato_contas ADD COLUMN IF NOT EXISTS cv_storage_path text;
ALTER TABLE public.candidato_contas ADD COLUMN IF NOT EXISTS cv_nome_arquivo text;
ALTER TABLE public.candidato_contas ADD COLUMN IF NOT EXISTS cv_gerado jsonb;
ALTER TABLE public.candidato_contas ADD COLUMN IF NOT EXISTS cv_atualizado_em timestamptz;

-- Path do CV da conta: conta/<conta_id>/... — do próprio titular logado.
CREATE OR REPLACE FUNCTION public.cv_path_da_conta(_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (storage.foldername(_name))[1] = 'conta'
     AND (storage.foldername(_name))[2] = auth.uid()::text
     AND EXISTS (SELECT 1 FROM public.candidato_contas c WHERE c.id = auth.uid());
$$;

-- Policies ADITIVAS no bucket curriculos (as de vaga continuam valendo — OR).
DROP POLICY IF EXISTS "cv conta titular envia" ON storage.objects;
CREATE POLICY "cv conta titular envia"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'curriculos' AND public.cv_path_da_conta(name));

DROP POLICY IF EXISTS "cv conta titular remove" ON storage.objects;
CREATE POLICY "cv conta titular remove"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'curriculos' AND public.cv_path_da_conta(name));

DROP POLICY IF EXISTS "cv conta titular le" ON storage.objects;
CREATE POLICY "cv conta titular le"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'curriculos' AND public.cv_path_da_conta(name));
