
-- Catálogo Departamento › Setor por empresa
CREATE TABLE public.departamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX departamentos_empresa_lowername_uq ON public.departamentos (empresa_id, lower(nome));
-- Para FK composta filha
ALTER TABLE public.departamentos ADD CONSTRAINT departamentos_empresa_id_uq UNIQUE (empresa_id, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departamentos TO authenticated;
GRANT ALL ON public.departamentos TO service_role;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY dep_sel ON public.departamentos FOR SELECT TO authenticated
  USING (is_super_admin() OR empresa_id = current_user_empresa());
CREATE POLICY dep_ins ON public.departamentos FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_vagas')));
CREATE POLICY dep_upd ON public.departamentos FOR UPDATE TO authenticated
  USING (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_vagas')))
  WITH CHECK (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_vagas')));
CREATE POLICY dep_del ON public.departamentos FOR DELETE TO authenticated
  USING (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_vagas')));

CREATE TABLE public.setores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  departamento_id uuid NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT setores_dep_emp_fk FOREIGN KEY (empresa_id, departamento_id)
    REFERENCES public.departamentos(empresa_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX setores_dep_lowername_uq ON public.setores (departamento_id, lower(nome));
ALTER TABLE public.setores ADD CONSTRAINT setores_empresa_id_uq UNIQUE (empresa_id, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.setores TO authenticated;
GRANT ALL ON public.setores TO service_role;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY set_sel ON public.setores FOR SELECT TO authenticated
  USING (is_super_admin() OR empresa_id = current_user_empresa());
CREATE POLICY set_ins ON public.setores FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_vagas')));
CREATE POLICY set_upd ON public.setores FOR UPDATE TO authenticated
  USING (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_vagas')))
  WITH CHECK (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_vagas')));
CREATE POLICY set_del ON public.setores FOR DELETE TO authenticated
  USING (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_vagas')));

-- vagas: adicionar departamento_id / setor_id com FK composta
ALTER TABLE public.vagas
  ADD COLUMN departamento_id uuid,
  ADD COLUMN setor_id uuid;

ALTER TABLE public.vagas
  ADD CONSTRAINT vagas_dep_emp_fk FOREIGN KEY (empresa_id, departamento_id)
    REFERENCES public.departamentos(empresa_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT vagas_set_emp_fk FOREIGN KEY (empresa_id, setor_id)
    REFERENCES public.setores(empresa_id, id) ON DELETE RESTRICT;

-- Trigger: garantir pertencimento + snapshot do nome em setor (text)
CREATE OR REPLACE FUNCTION public.vagas_sync_setor_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dep uuid; v_nome text;
BEGIN
  IF NEW.setor_id IS NOT NULL THEN
    SELECT departamento_id, nome INTO v_dep, v_nome FROM public.setores WHERE id = NEW.setor_id;
    IF v_dep IS NULL THEN RAISE EXCEPTION 'Setor inexistente'; END IF;
    IF NEW.departamento_id IS NOT NULL AND NEW.departamento_id <> v_dep THEN
      RAISE EXCEPTION 'Setor não pertence ao departamento informado';
    END IF;
    NEW.departamento_id := v_dep;
    NEW.setor := v_nome;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER vagas_sync_setor_snapshot_t
BEFORE INSERT OR UPDATE OF setor_id, departamento_id ON public.vagas
FOR EACH ROW EXECUTE FUNCTION public.vagas_sync_setor_snapshot();

-- Seed: para cada empresa existente sem departamentos, criar catálogo padrão
DO $$
DECLARE r record; d1 uuid; d2 uuid; d3 uuid;
BEGIN
  FOR r IN SELECT id FROM public.empresas LOOP
    IF NOT EXISTS (SELECT 1 FROM public.departamentos WHERE empresa_id = r.id) THEN
      INSERT INTO public.departamentos (empresa_id, nome, ordem) VALUES (r.id, 'Comercial', 1) RETURNING id INTO d1;
      INSERT INTO public.departamentos (empresa_id, nome, ordem) VALUES (r.id, 'Logística', 2) RETURNING id INTO d2;
      INSERT INTO public.departamentos (empresa_id, nome, ordem) VALUES (r.id, 'Administrativo', 3) RETURNING id INTO d3;
      INSERT INTO public.setores (empresa_id, departamento_id, nome, ordem) VALUES
        (r.id, d1, 'Televendas', 1), (r.id, d1, 'Vendas externas', 2), (r.id, d1, 'SAC / Pós-venda', 3),
        (r.id, d2, 'Estoque', 1), (r.id, d2, 'Expedição', 2), (r.id, d2, 'Recebimento', 3),
        (r.id, d3, 'Financeiro', 1), (r.id, d3, 'RH / DP', 2), (r.id, d3, 'Compras', 3);
    END IF;
  END LOOP;

  -- Migração de vagas antigas: para cada (empresa, setor texto) distinto sem setor_id, anexar a departamento "Geral"
  FOR r IN SELECT DISTINCT empresa_id, setor FROM public.vagas WHERE setor_id IS NULL AND COALESCE(setor,'') <> '' LOOP
    DECLARE v_dep uuid; v_set uuid;
    BEGIN
      SELECT id INTO v_dep FROM public.departamentos WHERE empresa_id = r.empresa_id AND lower(nome) = 'geral';
      IF v_dep IS NULL THEN
        INSERT INTO public.departamentos (empresa_id, nome, ordem) VALUES (r.empresa_id, 'Geral', 99) RETURNING id INTO v_dep;
      END IF;
      SELECT id INTO v_set FROM public.setores WHERE departamento_id = v_dep AND lower(nome) = lower(r.setor);
      IF v_set IS NULL THEN
        INSERT INTO public.setores (empresa_id, departamento_id, nome) VALUES (r.empresa_id, v_dep, r.setor) RETURNING id INTO v_set;
      END IF;
      UPDATE public.vagas SET setor_id = v_set, departamento_id = v_dep
        WHERE empresa_id = r.empresa_id AND setor = r.setor AND setor_id IS NULL;
    END;
  END LOOP;
END $$;
