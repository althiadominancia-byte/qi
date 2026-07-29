-- Passaporte de Talentos (fundação): estrutura competências, evidências,
-- experiências e preferências do candidato em tabelas próprias, ancoradas na
-- taxonomia (CBO/O*NET). Hoje anexado ao candidato; a separação pessoa↔
-- candidatura fica para um módulo futuro. Segue o padrão de tenant/RLS das
-- demais tabelas (empresa_id/unidade_id + user_can_access_unidade + user_has_perm).

-- ============= 1. Taxonomia de competências =============
-- empresa_id NULL = competência GLOBAL da plataforma; preenchida = custom da empresa.
CREATE TABLE IF NOT EXISTS public.competencias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  empresa_id  uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('tecnica','comportamental','transversal')),
  descricao   text,
  codigo_cbo  text,   -- âncora CBO (ocupação/família)
  codigo_onet text,   -- âncora O*NET
  ativo       boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_competencias_empresa ON public.competencias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_competencias_tipo ON public.competencias(tipo);

-- ============= 2. Trigger de tenant (deriva empresa/unidade do candidato) =============
CREATE OR REPLACE FUNCTION public.fill_tenant_from_candidato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS NULL OR NEW.unidade_id IS NULL THEN
    SELECT c.empresa_id, c.unidade_id INTO NEW.empresa_id, NEW.unidade_id
      FROM public.candidatos_televendas c WHERE c.id = NEW.candidato_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============= 3. Competências do candidato =============
CREATE TABLE IF NOT EXISTS public.candidato_competencias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  candidato_id  uuid NOT NULL REFERENCES public.candidatos_televendas(id) ON DELETE CASCADE,
  competencia_id uuid NOT NULL REFERENCES public.competencias(id) ON DELETE CASCADE,
  empresa_id    uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id    uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  nivel         smallint NOT NULL DEFAULT 3 CHECK (nivel BETWEEN 1 AND 5),
  origem        text NOT NULL DEFAULT 'declarada' CHECK (origem IN ('declarada','avaliada','ia')),
  confianca     real,  -- 0..1 (para origem ia/avaliada)
  UNIQUE (candidato_id, competencia_id)
);
CREATE INDEX IF NOT EXISTS idx_cand_comp_candidato ON public.candidato_competencias(candidato_id);
CREATE INDEX IF NOT EXISTS idx_cand_comp_empresa ON public.candidato_competencias(empresa_id, unidade_id);
DROP TRIGGER IF EXISTS trg_fill_cand_comp ON public.candidato_competencias;
CREATE TRIGGER trg_fill_cand_comp BEFORE INSERT ON public.candidato_competencias
  FOR EACH ROW EXECUTE FUNCTION public.fill_tenant_from_candidato();

-- ============= 4. Evidências =============
CREATE TABLE IF NOT EXISTS public.candidato_evidencias (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  candidato_id   uuid NOT NULL REFERENCES public.candidatos_televendas(id) ON DELETE CASCADE,
  competencia_id uuid REFERENCES public.competencias(id) ON DELETE SET NULL,
  empresa_id     uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id     uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  tipo           text NOT NULL CHECK (tipo IN ('projeto','certificado','portfolio','experiencia','desafio','link')),
  titulo         text NOT NULL,
  descricao      text,
  url            text,
  storage_path   text
);
CREATE INDEX IF NOT EXISTS idx_cand_evid_candidato ON public.candidato_evidencias(candidato_id);
DROP TRIGGER IF EXISTS trg_fill_cand_evid ON public.candidato_evidencias;
CREATE TRIGGER trg_fill_cand_evid BEFORE INSERT ON public.candidato_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.fill_tenant_from_candidato();

-- ============= 5. Experiências (formais e informais, sem penalização) =============
CREATE TABLE IF NOT EXISTS public.candidato_experiencias (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  candidato_id uuid NOT NULL REFERENCES public.candidatos_televendas(id) ON DELETE CASCADE,
  empresa_id   uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id   uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  tipo         text NOT NULL DEFAULT 'formal' CHECK (tipo IN ('formal','informal','voluntariado','projeto','curso')),
  titulo       text NOT NULL,
  organizacao  text,
  inicio       date,
  fim          date,
  atual        boolean NOT NULL DEFAULT false,
  descricao    text
);
CREATE INDEX IF NOT EXISTS idx_cand_exp_candidato ON public.candidato_experiencias(candidato_id);
DROP TRIGGER IF EXISTS trg_fill_cand_exp ON public.candidato_experiencias;
CREATE TRIGGER trg_fill_cand_exp BEFORE INSERT ON public.candidato_experiencias
  FOR EACH ROW EXECUTE FUNCTION public.fill_tenant_from_candidato();

-- ============= 6. Preferências (1:1 com candidato) =============
CREATE TABLE IF NOT EXISTS public.candidato_preferencias (
  candidato_id   uuid PRIMARY KEY REFERENCES public.candidatos_televendas(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  empresa_id     uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id     uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  disponibilidade text,
  pretensao_min  numeric,
  pretensao_max  numeric,
  modelo_trabalho text CHECK (modelo_trabalho IN ('presencial','hibrido','remoto','indiferente')),
  interesses     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ambiente       jsonb NOT NULL DEFAULT '{}'::jsonb
);
DROP TRIGGER IF EXISTS trg_fill_cand_pref ON public.candidato_preferencias;
CREATE TRIGGER trg_fill_cand_pref BEFORE INSERT ON public.candidato_preferencias
  FOR EACH ROW EXECUTE FUNCTION public.fill_tenant_from_candidato();

-- ============= 7. RLS =============
ALTER TABLE public.competencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidato_competencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidato_evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidato_experiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidato_preferencias ENABLE ROW LEVEL SECURITY;

-- Taxonomia: lê global (empresa_id null) + a da própria empresa; escreve global
-- só super_admin, custom da empresa quem tem gerenciar_catalogo.
DROP POLICY IF EXISTS "comp select" ON public.competencias;
CREATE POLICY "comp select" ON public.competencias FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR public.is_super_admin() OR empresa_id = public.current_user_empresa());
DROP POLICY IF EXISTS "comp super global" ON public.competencias;
CREATE POLICY "comp super global" ON public.competencias FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "comp empresa custom" ON public.competencias;
CREATE POLICY "comp empresa custom" ON public.competencias FOR ALL TO authenticated
  USING (empresa_id = public.current_user_empresa() AND public.user_has_perm('gerenciar_catalogo'))
  WITH CHECK (empresa_id = public.current_user_empresa() AND public.user_has_perm('gerenciar_catalogo'));

-- Dados do candidato: leitura sob escopo (ver_candidatos); escrita sob escopo
-- (fluxo real via serverFn/service role; estas cobrem cliente autenticado).

DROP POLICY IF EXISTS "cand_comp select" ON public.candidato_competencias;
CREATE POLICY "cand_comp select" ON public.candidato_competencias FOR SELECT TO authenticated
  USING ((public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id)) AND public.user_has_perm('ver_candidatos'));
DROP POLICY IF EXISTS "cand_comp write" ON public.candidato_competencias;
CREATE POLICY "cand_comp write" ON public.candidato_competencias FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
  WITH CHECK (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id));

DROP POLICY IF EXISTS "cand_evid select" ON public.candidato_evidencias;
CREATE POLICY "cand_evid select" ON public.candidato_evidencias FOR SELECT TO authenticated
  USING ((public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id)) AND public.user_has_perm('ver_candidatos'));
DROP POLICY IF EXISTS "cand_evid write" ON public.candidato_evidencias;
CREATE POLICY "cand_evid write" ON public.candidato_evidencias FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
  WITH CHECK (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id));

DROP POLICY IF EXISTS "cand_exp select" ON public.candidato_experiencias;
CREATE POLICY "cand_exp select" ON public.candidato_experiencias FOR SELECT TO authenticated
  USING ((public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id)) AND public.user_has_perm('ver_candidatos'));
DROP POLICY IF EXISTS "cand_exp write" ON public.candidato_experiencias;
CREATE POLICY "cand_exp write" ON public.candidato_experiencias FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
  WITH CHECK (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id));

DROP POLICY IF EXISTS "cand_pref select" ON public.candidato_preferencias;
CREATE POLICY "cand_pref select" ON public.candidato_preferencias FOR SELECT TO authenticated
  USING ((public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id)) AND public.user_has_perm('ver_candidatos'));
DROP POLICY IF EXISTS "cand_pref write" ON public.candidato_preferencias;
CREATE POLICY "cand_pref write" ON public.candidato_preferencias FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
  WITH CHECK (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id));

-- ============= 8. Seed da taxonomia inicial (global) =============
-- Começa pelas famílias iniciais (administrativo/financeiro, vendas/atendimento).
-- Idempotente por (nome global) via NOT EXISTS.
INSERT INTO public.competencias (empresa_id, nome, tipo, descricao, codigo_cbo)
SELECT * FROM (VALUES
  (NULL::uuid, 'Comunicação',            'comportamental', 'Clareza na comunicação oral e escrita', NULL::text),
  (NULL, 'Negociação',            'comportamental', 'Conduzir acordos e fechar vendas', NULL),
  (NULL, 'Orientação a resultados','comportamental', 'Foco em metas e entrega', NULL),
  (NULL, 'Colaboração',           'comportamental', 'Trabalho em equipe', NULL),
  (NULL, 'Adaptabilidade',        'comportamental', 'Lidar com mudança e ambiguidade', NULL),
  (NULL, 'Organização',           'comportamental', 'Gestão de tempo e prioridades', NULL),
  (NULL, 'Atendimento ao cliente','tecnica',        'Suporte e relacionamento com clientes', NULL),
  (NULL, 'Vendas / Televendas',   'tecnica',        'Prospecção e fechamento por telefone', NULL),
  (NULL, 'Rotinas administrativas','tecnica',       'Controle de documentos e processos', NULL),
  (NULL, 'Excel / Planilhas',     'tecnica',        'Manipulação de dados em planilhas', NULL),
  (NULL, 'Rotinas financeiras',   'tecnica',        'Contas a pagar/receber, conciliação', NULL),
  (NULL, 'Aprendizado rápido',    'transversal',    'Velocidade de aprendizagem e aplicação de feedback', NULL),
  (NULL, 'Resolução de problemas','transversal',    'Raciocínio e solução de problemas novos', NULL)
) AS v(empresa_id, nome, tipo, descricao, codigo_cbo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.competencias c WHERE c.empresa_id IS NULL AND c.nome = v.nome
);
