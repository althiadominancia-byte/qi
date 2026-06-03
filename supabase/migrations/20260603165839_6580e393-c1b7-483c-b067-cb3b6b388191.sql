
CREATE TABLE public.permissoes_papel (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin_empresa','recrutador','visualizador')),
  perms jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_papel TO authenticated;
GRANT ALL ON public.permissoes_papel TO service_role;

ALTER TABLE public.permissoes_papel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissoes_papel_select_empresa" ON public.permissoes_papel
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR empresa_id = public.current_user_empresa());

CREATE POLICY "permissoes_papel_insert" ON public.permissoes_papel
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin()
    OR (empresa_id = public.current_user_empresa() AND public.user_has_perm('gerenciar_usuarios')));

CREATE POLICY "permissoes_papel_update" ON public.permissoes_papel
  FOR UPDATE TO authenticated
  USING (public.is_super_admin()
    OR (empresa_id = public.current_user_empresa() AND public.user_has_perm('gerenciar_usuarios')))
  WITH CHECK (public.is_super_admin()
    OR (empresa_id = public.current_user_empresa() AND public.user_has_perm('gerenciar_usuarios')));

CREATE POLICY "permissoes_papel_delete" ON public.permissoes_papel
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE TRIGGER permissoes_papel_updated_at
  BEFORE UPDATE ON public.permissoes_papel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.preset_perms(_role text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'admin_empresa' THEN jsonb_build_object(
      'gerenciar_usuarios', true, 'gerenciar_vagas', true, 'encerrar_vagas', true,
      'ver_candidatos', true, 'ver_curriculo', true, 'ver_diversidade', true,
      'exportar', true, 'gerenciar_catalogo', true)
    WHEN 'recrutador' THEN jsonb_build_object(
      'gerenciar_usuarios', false, 'gerenciar_vagas', true, 'encerrar_vagas', true,
      'ver_candidatos', true, 'ver_curriculo', true, 'ver_diversidade', true,
      'exportar', false, 'gerenciar_catalogo', false)
    WHEN 'visualizador' THEN jsonb_build_object(
      'gerenciar_usuarios', false, 'gerenciar_vagas', false, 'encerrar_vagas', false,
      'ver_candidatos', true, 'ver_curriculo', true, 'ver_diversidade', false,
      'exportar', false, 'gerenciar_catalogo', false)
    ELSE '{}'::jsonb
  END
$$;

INSERT INTO public.permissoes_papel (empresa_id, role, perms)
SELECT e.id, r.role, public.preset_perms(r.role)
FROM public.empresas e
CROSS JOIN (VALUES ('admin_empresa'),('recrutador'),('visualizador')) AS r(role)
ON CONFLICT (empresa_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_permissoes_papel_for_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.permissoes_papel (empresa_id, role, perms) VALUES
    (NEW.id, 'admin_empresa', public.preset_perms('admin_empresa')),
    (NEW.id, 'recrutador',    public.preset_perms('recrutador')),
    (NEW.id, 'visualizador',  public.preset_perms('visualizador'))
  ON CONFLICT (empresa_id, role) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER empresas_seed_permissoes
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.seed_permissoes_papel_for_empresa();

-- Migrar perms para override esparso
WITH base AS (
  SELECT u.id, u.role::text AS role, u.empresa_id,
         COALESCE(u.perms, '{}'::jsonb) AS uperms,
         COALESCE(pp.perms, public.preset_perms(u.role::text)) AS rperms
  FROM public.usuarios u
  LEFT JOIN public.permissoes_papel pp
    ON pp.empresa_id = u.empresa_id AND pp.role = u.role::text
  WHERE u.role::text IN ('admin_empresa','recrutador','visualizador')
),
diffs AS (
  SELECT b.id,
    COALESCE(
      jsonb_object_agg(k.key, k.val)
        FILTER (WHERE k.val IS NOT NULL AND k.val <> COALESCE(b.rperms -> k.key, 'null'::jsonb)),
      '{}'::jsonb
    ) AS override
  FROM base b
  LEFT JOIN LATERAL jsonb_each(b.uperms) AS k(key, val) ON true
  GROUP BY b.id
)
UPDATE public.usuarios u
   SET perms = d.override
  FROM diffs d
 WHERE u.id = d.id;

CREATE OR REPLACE FUNCTION public.user_has_perm(_perm text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role text; v_empresa uuid; v_ativo boolean; v_emp_ativa boolean;
  v_override jsonb; v_default jsonb;
BEGIN
  SELECT u.role::text, u.empresa_id, u.ativo, u.perms, COALESCE(e.ativo, false)
    INTO v_role, v_empresa, v_ativo, v_override, v_emp_ativa
    FROM public.usuarios u
    LEFT JOIN public.empresas e ON e.id = u.empresa_id
    WHERE u.id = auth.uid();

  IF v_role IS NULL OR NOT v_ativo THEN RETURN false; END IF;
  IF v_role = 'super_admin' THEN RETURN true; END IF;
  IF NOT v_emp_ativa THEN RETURN false; END IF;

  IF v_override ? _perm THEN
    RETURN COALESCE((v_override ->> _perm)::boolean, false);
  END IF;

  SELECT pp.perms INTO v_default
    FROM public.permissoes_papel pp
   WHERE pp.empresa_id = v_empresa AND pp.role = v_role;

  IF v_default IS NULL THEN v_default := public.preset_perms(v_role); END IF;

  RETURN COALESCE((v_default ->> _perm)::boolean, false);
END $$;

CREATE OR REPLACE FUNCTION public.user_effective_perms(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role text; v_empresa uuid; v_override jsonb; v_default jsonb;
BEGIN
  SELECT u.role::text, u.empresa_id, COALESCE(u.perms,'{}'::jsonb)
    INTO v_role, v_empresa, v_override
    FROM public.usuarios u WHERE u.id = _user_id;

  IF v_role IS NULL THEN RETURN '{}'::jsonb; END IF;

  IF v_role = 'super_admin' THEN
    RETURN jsonb_build_object(
      'gerenciar_usuarios', true, 'gerenciar_vagas', true, 'encerrar_vagas', true,
      'ver_candidatos', true, 'ver_curriculo', true, 'ver_diversidade', true,
      'exportar', true, 'gerenciar_catalogo', true);
  END IF;

  SELECT pp.perms INTO v_default
    FROM public.permissoes_papel pp
   WHERE pp.empresa_id = v_empresa AND pp.role = v_role;

  IF v_default IS NULL THEN v_default := public.preset_perms(v_role); END IF;

  RETURN v_default || v_override;
END $$;

GRANT EXECUTE ON FUNCTION public.preset_perms(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_effective_perms(uuid) TO authenticated, service_role;
