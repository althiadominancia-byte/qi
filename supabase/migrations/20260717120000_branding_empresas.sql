-- White-label por empresa: logo + cores da marca.
-- Cada empresa (tenant) pode definir sua identidade visual, aplicada no painel
-- interno e no formulário público do candidato.

-- ============= 1. Colunas de branding em empresas =============
-- Todas nullable: sem valor => a aplicação cai no fallback da marca padrão.
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS logo_path    text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cor_primaria text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cor_sidebar  text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cor_botao    text;

-- ============= 2. Bucket público de logos =============
-- Público para leitura: o candidato anônimo precisa exibir a logo no /c/$token.
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Escrita (upload/atualização/remoção) restrita: super_admin (qualquer empresa)
-- ou usuário ativo cuja empresa = 1ª pasta do path (<empresa_id>/logo.<ext>).
-- Espelha o padrão do bucket 'curriculos'.
DROP POLICY IF EXISTS "logos manage" ON storage.objects;
CREATE POLICY "logos manage"
ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'logos'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.ativo
        AND (u.empresa_id)::text = (storage.foldername(name))[1]
    )
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.ativo
        AND (u.empresa_id)::text = (storage.foldername(name))[1]
    )
  )
);

-- ============= 3. RPC pública de branding =============
-- Retorna SÓ as colunas de branding de uma empresa ativa, sem expor a tabela
-- empresas inteira ao anon. Usada pelo formulário público do candidato.
CREATE OR REPLACE FUNCTION public.get_empresa_branding(p_empresa_id uuid)
RETURNS TABLE (nome text, logo_path text, cor_primaria text, cor_sidebar text, cor_botao text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.nome, e.logo_path, e.cor_primaria, e.cor_sidebar, e.cor_botao
  FROM public.empresas e
  WHERE e.id = p_empresa_id AND e.ativo;
$$;

GRANT EXECUTE ON FUNCTION public.get_empresa_branding(uuid) TO anon, authenticated;
