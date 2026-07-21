-- Planos (entitlements por empresa). O super_admin define modelos de plano com um
-- conjunto de features; cada empresa recebe um plano; exceções via override na
-- própria empresa. features efetivas = plano.features || empresa.features.

-- ============= 1. Tabela planos (nível plataforma) =============
CREATE TABLE IF NOT EXISTS public.planos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  nome       text NOT NULL,
  descricao  text,
  features   jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem      int NOT NULL DEFAULT 0,
  ativo      boolean NOT NULL DEFAULT true
);

-- ============= 2. Vínculo em empresas =============
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS plano_id uuid REFERENCES public.planos(id) ON DELETE SET NULL;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS features jsonb;  -- override esparso (exceções)

-- ============= 3. Seed dos 3 modelos padrão (idempotente por id fixo) =============
INSERT INTO public.planos (id, nome, descricao, ordem, features) VALUES
  ('00000000-0000-0000-0002-000000000001', 'Básico',
   'Vagas, candidatos e DISC. Recursos avançados desligados.', 1,
   '{"analise_cv_ia":false,"disc":true,"situacional":true,"diversidade":false,"avaliacao_experiencia":false,"niveis_lideranca":false,"multiplas_unidades":false,"white_label":false,"exportacao":false,"entrevista_ia":false}'::jsonb),
  ('00000000-0000-0000-0002-000000000002', 'Pro',
   'Recrutamento completo com IA, diversidade e múltiplas unidades.', 2,
   '{"analise_cv_ia":true,"disc":true,"situacional":true,"diversidade":true,"avaliacao_experiencia":true,"niveis_lideranca":true,"multiplas_unidades":true,"white_label":false,"exportacao":true,"entrevista_ia":false}'::jsonb),
  ('00000000-0000-0000-0002-000000000003', 'Enterprise',
   'Tudo liberado, incluindo white-label e entrevista por vídeo com IA.', 3,
   '{"analise_cv_ia":true,"disc":true,"situacional":true,"diversidade":true,"avaliacao_experiencia":true,"niveis_lideranca":true,"multiplas_unidades":true,"white_label":true,"exportacao":true,"entrevista_ia":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Grandfather: empresas existentes sem plano => Enterprise, para nada quebrar
-- antes de o super revisar os contratos.
UPDATE public.empresas SET plano_id = '00000000-0000-0000-0002-000000000003'
 WHERE plano_id IS NULL;

-- ============= 4. RLS =============
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

-- Leitura liberada a autenticados (definição de plano não é sensível; usada para
-- exibir o nome do plano). Escrita só super_admin.
DROP POLICY IF EXISTS "planos leitura" ON public.planos;
CREATE POLICY "planos leitura" ON public.planos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "planos super escreve" ON public.planos;
CREATE POLICY "planos super escreve" ON public.planos FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- (empresas.plano_id / features já são protegidos pelas policies existentes de
--  empresas — só super_admin atualiza.)

-- ============= 5. RPC: features efetivas de uma empresa =============
-- Merge do plano com o override da empresa (override vence). Vazio => a aplicação
-- trata como permissivo (tudo liberado) via resolveFeatures no cliente.
CREATE OR REPLACE FUNCTION public.get_empresa_features(p_empresa_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(p.features, '{}'::jsonb) || COALESCE(e.features, '{}'::jsonb)
    FROM public.empresas e
    LEFT JOIN public.planos p ON p.id = e.plano_id
   WHERE e.id = p_empresa_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_empresa_features(uuid) TO authenticated;
