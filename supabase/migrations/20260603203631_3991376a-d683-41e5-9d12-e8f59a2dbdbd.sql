
-- ============ 1) Jornada nos candidatos ============
ALTER TABLE public.candidatos_televendas
  ADD COLUMN IF NOT EXISTS etapa text NOT NULL DEFAULT 'inscrito',
  ADD COLUMN IF NOT EXISTS entrevista_data timestamptz,
  ADD COLUMN IF NOT EXISTS entrevista_obs text,
  ADD COLUMN IF NOT EXISTS nao_contratado_motivo text,
  ADD COLUMN IF NOT EXISTS etapa_atualizada_em timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.candidatos_televendas
  DROP CONSTRAINT IF EXISTS candidatos_etapa_check;
ALTER TABLE public.candidatos_televendas
  ADD CONSTRAINT candidatos_etapa_check
  CHECK (etapa IN ('inscrito','entrevista','contratado','nao_contratado'));

ALTER TABLE public.candidatos_televendas
  DROP CONSTRAINT IF EXISTS candidatos_motivo_check;
ALTER TABLE public.candidatos_televendas
  ADD CONSTRAINT candidatos_motivo_check
  CHECK (nao_contratado_motivo IS NULL OR nao_contratado_motivo IN ('vaga_preenchida','encerramento_insucesso'));

CREATE INDEX IF NOT EXISTS idx_cand_etapa ON public.candidatos_televendas(vaga_id, etapa);

-- ============ 2) Lideres ============
CREATE TABLE IF NOT EXISTS public.lideres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text,
  telefone text,
  nivel text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lideres_nivel_check CHECK (nivel IN ('gestor','coordenador','supervisor'))
);

-- unique pair (empresa_id, id) so lider_areas can compose FK by empresa
CREATE UNIQUE INDEX IF NOT EXISTS lideres_empresa_id_uq ON public.lideres(empresa_id, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lideres TO authenticated;
GRANT ALL ON public.lideres TO service_role;
ALTER TABLE public.lideres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lideres_sel ON public.lideres;
DROP POLICY IF EXISTS lideres_ins ON public.lideres;
DROP POLICY IF EXISTS lideres_upd ON public.lideres;
DROP POLICY IF EXISTS lideres_del ON public.lideres;

CREATE POLICY lideres_sel ON public.lideres FOR SELECT TO authenticated
  USING (is_super_admin() OR empresa_id = current_user_empresa());
CREATE POLICY lideres_ins ON public.lideres FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')));
CREATE POLICY lideres_upd ON public.lideres FOR UPDATE TO authenticated
  USING (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')))
  WITH CHECK (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')));
CREATE POLICY lideres_del ON public.lideres FOR DELETE TO authenticated
  USING (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')));

DROP TRIGGER IF EXISTS trg_lideres_updated_at ON public.lideres;
CREATE TRIGGER trg_lideres_updated_at BEFORE UPDATE ON public.lideres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3) Lider areas ============
CREATE TABLE IF NOT EXISTS public.lider_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  lider_id uuid NOT NULL,
  departamento_id uuid NOT NULL,
  setor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lider_areas_lider_emp_fk FOREIGN KEY (empresa_id, lider_id) REFERENCES public.lideres(empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT lider_areas_dep_emp_fk FOREIGN KEY (empresa_id, departamento_id) REFERENCES public.departamentos(empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT lider_areas_setor_emp_fk FOREIGN KEY (empresa_id, setor_id) REFERENCES public.setores(empresa_id, id) ON DELETE CASCADE
);

-- Garantir unicidade tratando setor_id null
CREATE UNIQUE INDEX IF NOT EXISTS lider_areas_uq_dep_null
  ON public.lider_areas(lider_id, departamento_id) WHERE setor_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lider_areas_uq_dep_setor
  ON public.lider_areas(lider_id, departamento_id, setor_id) WHERE setor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lider_areas_setor ON public.lider_areas(empresa_id, setor_id);
CREATE INDEX IF NOT EXISTS idx_lider_areas_dep ON public.lider_areas(empresa_id, departamento_id);

-- Setor deve pertencer ao mesmo departamento
CREATE OR REPLACE FUNCTION public.lider_areas_check_setor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.setor_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.setores s
      WHERE s.id = NEW.setor_id AND s.empresa_id = NEW.empresa_id AND s.departamento_id = NEW.departamento_id
    ) THEN
      RAISE EXCEPTION 'Setor não pertence ao departamento informado.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lider_areas_check ON public.lider_areas;
CREATE TRIGGER trg_lider_areas_check BEFORE INSERT OR UPDATE ON public.lider_areas
  FOR EACH ROW EXECUTE FUNCTION public.lider_areas_check_setor();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lider_areas TO authenticated;
GRANT ALL ON public.lider_areas TO service_role;
ALTER TABLE public.lider_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lider_areas_sel ON public.lider_areas;
DROP POLICY IF EXISTS lider_areas_ins ON public.lider_areas;
DROP POLICY IF EXISTS lider_areas_upd ON public.lider_areas;
DROP POLICY IF EXISTS lider_areas_del ON public.lider_areas;

CREATE POLICY lider_areas_sel ON public.lider_areas FOR SELECT TO authenticated
  USING (is_super_admin() OR empresa_id = current_user_empresa());
CREATE POLICY lider_areas_ins ON public.lider_areas FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')));
CREATE POLICY lider_areas_upd ON public.lider_areas FOR UPDATE TO authenticated
  USING (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')))
  WITH CHECK (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')));
CREATE POLICY lider_areas_del ON public.lider_areas FOR DELETE TO authenticated
  USING (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')));

-- ============ 4) Lider imediato na contratação ============
ALTER TABLE public.contratacoes
  ADD COLUMN IF NOT EXISTS lider_id uuid REFERENCES public.lideres(id) ON DELETE SET NULL;
