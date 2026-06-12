
-- 1) Tabela
CREATE TABLE public.niveis_lideranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
CREATE INDEX idx_niveis_lid_emp ON public.niveis_lideranca(empresa_id, ordem);

-- 2) GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.niveis_lideranca TO authenticated;
GRANT ALL ON public.niveis_lideranca TO service_role;

-- 3) RLS
ALTER TABLE public.niveis_lideranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "niveis_lid_sel" ON public.niveis_lideranca
  FOR SELECT TO authenticated
  USING (is_super_admin() OR empresa_id = current_user_empresa());

CREATE POLICY "niveis_lid_ins" ON public.niveis_lideranca
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')));

CREATE POLICY "niveis_lid_upd" ON public.niveis_lideranca
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')))
  WITH CHECK (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')));

CREATE POLICY "niveis_lid_del" ON public.niveis_lideranca
  FOR DELETE TO authenticated
  USING (is_super_admin() OR (empresa_id = current_user_empresa() AND user_has_perm('gerenciar_catalogo')));

-- 4) updated_at
CREATE TRIGGER trg_niveis_lid_updated_at
  BEFORE UPDATE ON public.niveis_lideranca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Seed nas empresas existentes
INSERT INTO public.niveis_lideranca (empresa_id, nome, ordem, ativo)
SELECT e.id, x.nome, x.ordem, true
FROM public.empresas e
CROSS JOIN (VALUES ('Gestor', 0), ('Coordenador', 1), ('Supervisor', 2)) AS x(nome, ordem)
ON CONFLICT (empresa_id, nome) DO NOTHING;

-- 6) Trigger para novas empresas
CREATE OR REPLACE FUNCTION public.seed_niveis_lideranca_for_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.niveis_lideranca (empresa_id, nome, ordem, ativo) VALUES
    (NEW.id, 'Gestor', 0, true),
    (NEW.id, 'Coordenador', 1, true),
    (NEW.id, 'Supervisor', 2, true)
  ON CONFLICT (empresa_id, nome) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_niveis_lid ON public.empresas;
CREATE TRIGGER trg_seed_niveis_lid
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.seed_niveis_lideranca_for_empresa();

-- 7) Remove restrição fixa na tabela de líderes (passa a aceitar qualquer nível cadastrado)
ALTER TABLE public.lideres DROP CONSTRAINT IF EXISTS lideres_nivel_check;
