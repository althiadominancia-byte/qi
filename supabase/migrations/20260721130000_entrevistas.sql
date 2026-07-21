-- Módulo de Entrevista por vídeo com IA (Fase 0 — fundação de dados).
--
-- Guarda a sessão de entrevista (sala LiveKit + gravação + transcrição + análise
-- de CONTEÚDO da IA) e o consentimento LGPD do candidato. A decisão de avançar/
-- reprovar é SEMPRE humana (decisao_humana + decisao_por) — nunca automática.
-- Segue o padrão de tenant/RLS das demais tabelas (empresa_id/unidade_id +
-- user_can_access_unidade + user_has_perm).

-- ============= 1. Tabela entrevistas =============
CREATE TABLE IF NOT EXISTS public.entrevistas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  candidato_id  uuid NOT NULL REFERENCES public.candidatos_televendas(id) ON DELETE CASCADE,
  vaga_id       uuid REFERENCES public.vagas(id) ON DELETE SET NULL,
  empresa_id    uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id    uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  agendada_para timestamptz,
  status        text NOT NULL DEFAULT 'agendada'
                CHECK (status IN ('agendada','em_andamento','gravada','transcrita','analisada','sem_gravacao','cancelada')),
  livekit_room  text,
  gravacao_path text,                 -- caminho no bucket privado 'entrevistas'
  transcricao   text,
  analise       jsonb,                -- resultado da IA (competências, consistência, resumo)
  decisao_humana text CHECK (decisao_humana IN ('avancar','reprovar')),
  decisao_por   uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  decisao_em    timestamptz,
  criado_por    uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  token         text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text  -- link público do candidato
);

CREATE INDEX IF NOT EXISTS idx_entrevistas_empresa_unidade ON public.entrevistas(empresa_id, unidade_id);
CREATE INDEX IF NOT EXISTS idx_entrevistas_candidato ON public.entrevistas(candidato_id);
CREATE INDEX IF NOT EXISTS idx_entrevistas_status ON public.entrevistas(status);

-- ============= 2. Tabela de consentimento (auditoria LGPD, separada) =============
CREATE TABLE IF NOT EXISTS public.entrevista_consentimentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  entrevista_id uuid NOT NULL REFERENCES public.entrevistas(id) ON DELETE CASCADE,
  candidato_id  uuid REFERENCES public.candidatos_televendas(id) ON DELETE SET NULL,
  consentiu     boolean NOT NULL,
  versao_termo  text NOT NULL,
  ip            text
);
CREATE INDEX IF NOT EXISTS idx_entrev_consent_entrevista ON public.entrevista_consentimentos(entrevista_id);

-- ============= 3. Trigger anti-cross-tenant: deriva empresa/unidade do candidato =============
CREATE OR REPLACE FUNCTION public.fill_entrevista_from_candidato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS NULL OR NEW.unidade_id IS NULL OR NEW.vaga_id IS NULL THEN
    SELECT c.empresa_id, c.unidade_id, c.vaga_id
      INTO NEW.empresa_id, NEW.unidade_id, NEW.vaga_id
      FROM public.candidatos_televendas c
     WHERE c.id = NEW.candidato_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_entrevista ON public.entrevistas;
CREATE TRIGGER trg_fill_entrevista
  BEFORE INSERT ON public.entrevistas
  FOR EACH ROW EXECUTE FUNCTION public.fill_entrevista_from_candidato();

-- ============= 4. RLS =============
ALTER TABLE public.entrevistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrevista_consentimentos ENABLE ROW LEVEL SECURITY;

-- Recrutador com escopo + permissão conduzir_entrevistas. Inserções/atualizações
-- do fluxo real acontecem via server function (service role, ignora RLS); estas
-- políticas cobrem acesso direto do cliente autenticado.
DROP POLICY IF EXISTS "entrev scope select" ON public.entrevistas;
CREATE POLICY "entrev scope select" ON public.entrevistas FOR SELECT TO authenticated
  USING (
    (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
    AND public.user_has_perm('conduzir_entrevistas')
  );

DROP POLICY IF EXISTS "entrev scope insert" ON public.entrevistas;
CREATE POLICY "entrev scope insert" ON public.entrevistas FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
    AND public.user_has_perm('conduzir_entrevistas')
  );

DROP POLICY IF EXISTS "entrev scope update" ON public.entrevistas;
CREATE POLICY "entrev scope update" ON public.entrevistas FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
  WITH CHECK (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id));

-- Consentimento: leitura sob escopo; escrita pelo fluxo público é via service role.
DROP POLICY IF EXISTS "entrev consent scope select" ON public.entrevista_consentimentos;
CREATE POLICY "entrev consent scope select" ON public.entrevista_consentimentos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.entrevistas e
    WHERE e.id = entrevista_id
      AND (public.is_super_admin() OR public.user_can_access_unidade(e.empresa_id, e.unidade_id))
  ));

-- ============= 5. Bucket privado de gravações + RLS (espelha 'curriculos') =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('entrevistas', 'entrevistas', false)
ON CONFLICT (id) DO NOTHING;

-- Path: {empresa_id}/{entrevista_id}/arquivo. Escrita real vem do egress do
-- LiveKit (credenciais S3/service role, ignora RLS); estas políticas cobrem app.
DROP POLICY IF EXISTS "entrev rec manage" ON storage.objects;
CREATE POLICY "entrev rec manage" ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'entrevistas'
    AND (public.is_super_admin()
         OR (public.current_user_empresa())::text = (storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'entrevistas'
    AND (public.is_super_admin()
         OR (public.current_user_empresa())::text = (storage.foldername(name))[1])
  );

-- ============= 6. RPC pública: dados mínimos para o candidato entrar por token =============
CREATE OR REPLACE FUNCTION public.get_entrevista_por_token(p_token text)
RETURNS TABLE (
  entrevista_id uuid, status text, agendada_para timestamptz,
  vaga_titulo text, empresa_id uuid, empresa_nome text,
  logo_path text, cor_primaria text, cor_sidebar text, cor_botao text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.status, e.agendada_para,
         v.titulo, emp.id, emp.nome,
         emp.logo_path, emp.cor_primaria, emp.cor_sidebar, emp.cor_botao
    FROM public.entrevistas e
    JOIN public.empresas emp ON emp.id = e.empresa_id
    LEFT JOIN public.vagas v ON v.id = e.vaga_id
   WHERE e.token = p_token AND emp.ativo;
$$;
GRANT EXECUTE ON FUNCTION public.get_entrevista_por_token(text) TO anon, authenticated;

-- ============= 7. Retenção: apaga gravação e transcrição após 90 dias =============
-- Minimização de dados (LGPD): mantém metadados da entrevista, mas remove a
-- mídia e a transcrição passados 90 dias da criação.
CREATE OR REPLACE FUNCTION public.limpar_entrevistas_expiradas()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM storage.objects
   WHERE bucket_id = 'entrevistas'
     AND name IN (
       SELECT gravacao_path FROM public.entrevistas
        WHERE gravacao_path IS NOT NULL AND created_at < now() - interval '90 days'
     );
  UPDATE public.entrevistas
     SET gravacao_path = NULL, transcricao = NULL
   WHERE created_at < now() - interval '90 days'
     AND (gravacao_path IS NOT NULL OR transcricao IS NOT NULL);
END;
$$;

-- Agenda diária, se o pg_cron estiver disponível (não falha a migration se não).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('limpar_entrevistas_expiradas', '30 3 * * *',
      'SELECT public.limpar_entrevistas_expiradas();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ignora se o schedule já existir ou o cron não estiver acessível
  NULL;
END $$;
