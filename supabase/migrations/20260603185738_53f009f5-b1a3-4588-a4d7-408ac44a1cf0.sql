
ALTER TABLE public.vagas
  ADD COLUMN IF NOT EXISTS encerrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS obs_encerramento text NOT NULL DEFAULT '';

-- =========== CONTRATACOES ===========
CREATE TABLE public.contratacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  empresa_id uuid NOT NULL,
  unidade_id uuid NOT NULL,
  vaga_id uuid NOT NULL REFERENCES public.vagas(id) ON DELETE CASCADE,
  candidato_id uuid REFERENCES public.candidatos_televendas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL DEFAULT '',
  data_admissao date NOT NULL,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','encerrada'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratacoes TO authenticated;
GRANT ALL ON public.contratacoes TO service_role;

ALTER TABLE public.contratacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratacoes scope select" ON public.contratacoes FOR SELECT TO authenticated
  USING (is_super_admin() OR user_can_access_unidade(empresa_id, unidade_id));
CREATE POLICY "contratacoes scope insert" ON public.contratacoes FOR INSERT TO authenticated
  WITH CHECK ((is_super_admin() OR user_can_access_unidade(empresa_id, unidade_id)) AND user_has_perm('encerrar_vagas'));
CREATE POLICY "contratacoes scope update" ON public.contratacoes FOR UPDATE TO authenticated
  USING (is_super_admin() OR user_can_access_unidade(empresa_id, unidade_id))
  WITH CHECK (is_super_admin() OR user_can_access_unidade(empresa_id, unidade_id));
CREATE POLICY "contratacoes scope delete" ON public.contratacoes FOR DELETE TO authenticated
  USING (is_super_admin());

CREATE OR REPLACE FUNCTION public.fill_contratacao_from_vaga()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_un uuid;
BEGIN
  IF NEW.vaga_id IS NULL THEN RAISE EXCEPTION 'vaga_id obrigatório'; END IF;
  SELECT empresa_id, unidade_id INTO v_emp, v_un FROM public.vagas WHERE id = NEW.vaga_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'vaga não encontrada'; END IF;
  NEW.empresa_id := v_emp;
  NEW.unidade_id := v_un;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_fill_contratacao BEFORE INSERT ON public.contratacoes
  FOR EACH ROW EXECUTE FUNCTION public.fill_contratacao_from_vaga();
CREATE TRIGGER trg_contratacoes_updated_at BEFORE UPDATE ON public.contratacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_contratacoes_vaga ON public.contratacoes (vaga_id);
CREATE INDEX idx_contratacoes_emp_un ON public.contratacoes (empresa_id, unidade_id);

-- =========== AVALIACOES ===========
CREATE TABLE public.avaliacoes_experiencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  empresa_id uuid NOT NULL,
  unidade_id uuid NOT NULL,
  contratacao_id uuid NOT NULL REFERENCES public.contratacoes(id) ON DELETE CASCADE,
  marco smallint NOT NULL CHECK (marco IN (30,60,90)),
  data_prevista date NOT NULL,
  status text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','enviada','respondida','cancelada')),
  enviada_em timestamptz,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  UNIQUE (contratacao_id, marco),
  UNIQUE (token)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes_experiencia TO authenticated;
GRANT ALL ON public.avaliacoes_experiencia TO service_role;

ALTER TABLE public.avaliacoes_experiencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "av scope select" ON public.avaliacoes_experiencia FOR SELECT TO authenticated
  USING (is_super_admin() OR user_can_access_unidade(empresa_id, unidade_id));
CREATE POLICY "av scope insert" ON public.avaliacoes_experiencia FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR user_can_access_unidade(empresa_id, unidade_id));
CREATE POLICY "av scope update" ON public.avaliacoes_experiencia FOR UPDATE TO authenticated
  USING (is_super_admin() OR user_can_access_unidade(empresa_id, unidade_id))
  WITH CHECK (is_super_admin() OR user_can_access_unidade(empresa_id, unidade_id));
CREATE POLICY "av scope delete" ON public.avaliacoes_experiencia FOR DELETE TO authenticated
  USING (is_super_admin());

CREATE OR REPLACE FUNCTION public.fill_avaliacao_from_contratacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_un uuid;
BEGIN
  SELECT empresa_id, unidade_id INTO v_emp, v_un FROM public.contratacoes WHERE id = NEW.contratacao_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'contratação não encontrada'; END IF;
  NEW.empresa_id := v_emp;
  NEW.unidade_id := v_un;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_fill_avaliacao BEFORE INSERT ON public.avaliacoes_experiencia
  FOR EACH ROW EXECUTE FUNCTION public.fill_avaliacao_from_contratacao();
CREATE TRIGGER trg_avaliacoes_updated_at BEFORE UPDATE ON public.avaliacoes_experiencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_av_status_data ON public.avaliacoes_experiencia (status, data_prevista);
CREATE INDEX idx_av_contratacao ON public.avaliacoes_experiencia (contratacao_id);
