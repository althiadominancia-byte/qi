-- Portal do Candidato (fundação): conta própria do candidato (ancorada em
-- auth.users) vinculada às candidaturas, auditoria do claim de vínculo e trilha
-- de alterações de dados do titular (LGPD art. 37). O acesso ao portal é gated
-- por plano via empresa_tem_portal() — FAIL-CLOSED (exposição de dados: sem a
-- chave, sem portal), ao contrário do gating permissivo de get_empresa_features.
-- Escrita nas tabelas do portal acontece SÓ via service-role (server functions).

-- ============= 1. Conta do candidato (1:1 com auth.users) =============
CREATE TABLE IF NOT EXISTS public.candidato_contas (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text NOT NULL,
  nome              text,
  versao_termo      text,
  aceitou_termos_em timestamptz,
  aceite_ip         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candidato_contas ENABLE ROW LEVEL SECURITY;

-- Cada conta lê apenas a si mesma; nada para anon; nenhuma policy de escrita
-- (INSERT/UPDATE/DELETE só via service-role nas server functions).
DROP POLICY IF EXISTS "conta le a si" ON public.candidato_contas;
CREATE POLICY "conta le a si" ON public.candidato_contas FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ============= 2. Vínculo conta -> candidaturas =============
ALTER TABLE public.candidatos_televendas
  ADD COLUMN IF NOT EXISTS conta_id uuid REFERENCES public.candidato_contas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cand_conta ON public.candidatos_televendas(conta_id);
CREATE INDEX IF NOT EXISTS idx_cand_email_lower ON public.candidatos_televendas (LOWER(email));

-- ============= 3. Auditoria do claim (tentativas de vínculo) =============
CREATE TABLE IF NOT EXISTS public.candidato_conta_vinculos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id     uuid NOT NULL REFERENCES public.candidato_contas(id) ON DELETE CASCADE,
  candidato_id uuid REFERENCES public.candidatos_televendas(id) ON DELETE SET NULL,
  sucesso      boolean NOT NULL,
  metodo       text NOT NULL DEFAULT 'celular_digitos',
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cand_vinculos_conta ON public.candidato_conta_vinculos(conta_id, created_at);

ALTER TABLE public.candidato_conta_vinculos ENABLE ROW LEVEL SECURITY;

-- Auditoria de staff: só super_admin lê; escrita só via service-role.
DROP POLICY IF EXISTS "vinculos super le" ON public.candidato_conta_vinculos;
CREATE POLICY "vinculos super le" ON public.candidato_conta_vinculos FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- ============= 4. Trilha de alterações do titular (LGPD art. 37) =============
CREATE TABLE IF NOT EXISTS public.candidato_alteracoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id   uuid NOT NULL REFERENCES public.candidatos_televendas(id) ON DELETE CASCADE,
  empresa_id     uuid,
  campo          text NOT NULL,
  valor_anterior text,
  valor_novo     text,
  autor          text NOT NULL DEFAULT 'titular',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cand_alteracoes_candidato ON public.candidato_alteracoes(candidato_id);

ALTER TABLE public.candidato_alteracoes ENABLE ROW LEVEL SECURITY;

-- Leitura: staff da plataforma ou recrutador com acesso à empresa (nível
-- empresa, sem unidade específica). Escrita só via service-role.
DROP POLICY IF EXISTS "alteracoes select" ON public.candidato_alteracoes;
CREATE POLICY "alteracoes select" ON public.candidato_alteracoes FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, NULL::uuid));

-- ============= 5. RPC: empresa tem portal? (FAIL-CLOSED) =============
-- Diferente do default permissivo de resolveFeatures/hasFeature, aqui o padrão
-- é FALSE: empresa inexistente, inativa ou sem a chave 'portal_candidato' nas
-- features efetivas (plano || override da empresa) => sem portal.
CREATE OR REPLACE FUNCTION public.empresa_tem_portal(p_empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT ((COALESCE(pl.features, '{}'::jsonb) || COALESCE(e.features, '{}'::jsonb)) ->> 'portal_candidato')::boolean
      FROM public.empresas e
      LEFT JOIN public.planos pl ON pl.id = e.plano_id
     WHERE e.id = p_empresa_id AND e.ativo
  ), false);
$$;
GRANT EXECUTE ON FUNCTION public.empresa_tem_portal(uuid) TO anon, authenticated;

-- ============= 6. Seed nos planos padrão (sem sobrescrever ajuste manual) =============
-- Só adiciona a chave se ela ainda não existir no plano (respeita ajustes do super).
UPDATE public.planos SET features = features || '{"portal_candidato": true}'::jsonb
 WHERE id IN ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0002-000000000003')
   AND NOT (features ? 'portal_candidato');

UPDATE public.planos SET features = features || '{"portal_candidato": false}'::jsonb
 WHERE id = '00000000-0000-0000-0002-000000000001'
   AND NOT (features ? 'portal_candidato');
