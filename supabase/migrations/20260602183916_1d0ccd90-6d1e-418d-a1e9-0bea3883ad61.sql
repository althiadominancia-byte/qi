
-- ============= 1. EMPRESAS =============
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.empresas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- ============= 2. UNIDADES =============
CREATE TABLE public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'filial' CHECK (tipo IN ('matriz','filial')),
  cidade text,
  cnpj text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX unidades_empresa_id_uk ON public.unidades(empresa_id, id);
CREATE INDEX idx_unidades_empresa ON public.unidades(empresa_id);
GRANT SELECT ON public.unidades TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

-- ============= 3. ENUM + USUARIOS =============
CREATE TYPE public.user_role AS ENUM ('super_admin','admin_empresa','recrutador','visualizador');

CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'visualizador',
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  todas_unidades boolean NOT NULL DEFAULT true,
  perms jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO authenticated;
GRANT ALL ON public.usuarios TO service_role;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.usuario_unidades (
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, unidade_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_unidades TO authenticated;
GRANT ALL ON public.usuario_unidades TO service_role;
ALTER TABLE public.usuario_unidades ENABLE ROW LEVEL SECURITY;

-- ============= 4. SEED EMPRESA + JEFFERSON SUPER ADMIN =============
INSERT INTO public.empresas (id, nome, cnpj, ativo)
VALUES ('00000000-0000-0000-0001-000000000001', 'Distribuidora Estrela', NULL, true);

INSERT INTO public.unidades (id, empresa_id, nome, tipo, cidade)
VALUES ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', 'Matriz — Macapá', 'matriz', 'Macapá - AP');

INSERT INTO public.usuarios (id, nome, email, role, empresa_id, todas_unidades, perms, ativo)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)), u.email,
  'super_admin'::public.user_role, NULL, true,
  '{"gerenciar_usuarios":true,"gerenciar_vagas":true,"encerrar_vagas":true,"ver_candidatos":true,"ver_curriculo":true,"ver_diversidade":true,"exportar":true}'::jsonb,
  true
FROM auth.users u
WHERE u.email = 'jefferson@distribuidoraestrela.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin', ativo = true, todas_unidades = true,
      perms = EXCLUDED.perms;

-- ============= 5. VAGAS: empresa_id + unidade_id + FK composta + link_token longo =============
ALTER TABLE public.vagas ADD COLUMN empresa_id uuid;
ALTER TABLE public.vagas ADD COLUMN unidade_id uuid;

UPDATE public.vagas
   SET empresa_id = '00000000-0000-0000-0001-000000000001',
       unidade_id = '00000000-0000-0000-0002-000000000001'
 WHERE empresa_id IS NULL;

ALTER TABLE public.vagas ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.vagas ALTER COLUMN unidade_id SET NOT NULL;

ALTER TABLE public.vagas
  ADD CONSTRAINT vagas_unidade_fk
  FOREIGN KEY (empresa_id, unidade_id)
  REFERENCES public.unidades(empresa_id, id)
  ON DELETE RESTRICT;

ALTER TABLE public.vagas ADD CONSTRAINT vagas_link_token_unique UNIQUE (link_token);
ALTER TABLE public.vagas ALTER COLUMN link_token SET DEFAULT encode(extensions.gen_random_bytes(24), 'hex');
CREATE INDEX idx_vagas_empresa_unidade ON public.vagas(empresa_id, unidade_id);

-- ============= 6. CANDIDATOS + DIVERSIDADE: empresa_id/unidade_id =============
ALTER TABLE public.candidatos_televendas ADD COLUMN empresa_id uuid;
ALTER TABLE public.candidatos_televendas ADD COLUMN unidade_id uuid;
UPDATE public.candidatos_televendas
   SET empresa_id = '00000000-0000-0000-0001-000000000001',
       unidade_id = '00000000-0000-0000-0002-000000000001'
 WHERE empresa_id IS NULL;
CREATE INDEX idx_cand_empresa_unidade ON public.candidatos_televendas(empresa_id, unidade_id);

ALTER TABLE public.diversidade_candidatos ADD COLUMN empresa_id uuid;
ALTER TABLE public.diversidade_candidatos ADD COLUMN unidade_id uuid;
ALTER TABLE public.diversidade_candidatos ADD COLUMN vaga_id uuid;

-- ============= 7. FUNÇÕES DE ESCOPO =============
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'super_admin' AND ativo);
$$;

CREATE OR REPLACE FUNCTION public.current_user_empresa()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT empresa_id FROM usuarios WHERE id = auth.uid() AND ativo
$$;

CREATE OR REPLACE FUNCTION public.user_has_perm(_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM usuarios u
    LEFT JOIN empresas e ON e.id = u.empresa_id
    WHERE u.id = auth.uid() AND u.ativo
      AND (u.role = 'super_admin' OR COALESCE(e.ativo, false))
      AND (u.role = 'super_admin' OR COALESCE((u.perms ->> _perm)::boolean, false))
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_unidade(_empresa uuid, _unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    LEFT JOIN empresas e ON e.id = u.empresa_id
    WHERE u.id = auth.uid() AND u.ativo
      AND (
        u.role = 'super_admin'
        OR (
          e.ativo AND u.empresa_id = _empresa
          AND (u.todas_unidades OR EXISTS (
            SELECT 1 FROM usuario_unidades uu
            WHERE uu.usuario_id = u.id AND uu.unidade_id = _unidade
          ))
        )
      )
  );
$$;

-- Atualiza is_recruiter para usar nova tabela usuarios
CREATE OR REPLACE FUNCTION public.is_recruiter(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM usuarios u
    LEFT JOIN empresas e ON e.id = u.empresa_id
    WHERE u.id = _user_id AND u.ativo
      AND u.role IN ('super_admin','admin_empresa','recrutador','visualizador')
      AND (u.role = 'super_admin' OR COALESCE(e.ativo, false))
  );
$$;

-- ============= 8. TRIGGER ANTI-CROSS-TENANT (candidato) =============
CREATE OR REPLACE FUNCTION public.fill_candidato_from_vaga()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_emp uuid; v_un uuid; v_status text; v_ativa boolean;
BEGIN
  IF NEW.vaga_id IS NULL THEN
    RAISE EXCEPTION 'vaga_id é obrigatório';
  END IF;
  SELECT v.empresa_id, v.unidade_id, v.status, COALESCE(e.ativo, true)
    INTO v_emp, v_un, v_status, v_ativa
    FROM public.vagas v LEFT JOIN public.empresas e ON e.id = v.empresa_id
    WHERE v.id = NEW.vaga_id;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'vaga não encontrada';
  END IF;
  IF v_status <> 'Aberta' OR NOT v_ativa THEN
    RAISE EXCEPTION 'vaga não está aberta para inscrições';
  END IF;
  -- Sobrepõe sempre — cliente não pode escolher empresa/unidade
  NEW.empresa_id := v_emp;
  NEW.unidade_id := v_un;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_fill_candidato
  BEFORE INSERT ON public.candidatos_televendas
  FOR EACH ROW EXECUTE FUNCTION public.fill_candidato_from_vaga();

-- ============= 9. RLS DEFAULT-DENY: vagas =============
DROP POLICY IF EXISTS "Anon lê vagas" ON public.vagas;
DROP POLICY IF EXISTS "Recrutadores apagam vagas" ON public.vagas;
DROP POLICY IF EXISTS "Recrutadores atualizam vagas" ON public.vagas;
DROP POLICY IF EXISTS "Recrutadores criam vagas" ON public.vagas;
DROP POLICY IF EXISTS "Recrutadores leem vagas" ON public.vagas;

CREATE POLICY "vagas anon lê (token)" ON public.vagas FOR SELECT TO anon
  USING (status = 'Aberta' AND EXISTS(SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND e.ativo));

CREATE POLICY "vagas scope select" ON public.vagas FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id));

CREATE POLICY "vagas scope insert" ON public.vagas FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
    AND public.user_has_perm('gerenciar_vagas')
  );

CREATE POLICY "vagas scope update" ON public.vagas FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
  WITH CHECK (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id));

CREATE POLICY "vagas scope delete" ON public.vagas FOR DELETE TO authenticated
  USING ((public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
         AND public.user_has_perm('gerenciar_vagas'));

-- ============= 10. RLS: candidatos =============
DROP POLICY IF EXISTS "Qualquer um pode se inscrever (anon)" ON public.candidatos_televendas;
DROP POLICY IF EXISTS "Qualquer um pode se inscrever (auth)" ON public.candidatos_televendas;
DROP POLICY IF EXISTS "Recrutadores atualizam candidatos (cv_analise)" ON public.candidatos_televendas;
DROP POLICY IF EXISTS "Recrutadores leem candidatos" ON public.candidatos_televendas;

CREATE POLICY "cand anon inscreve" ON public.candidatos_televendas FOR INSERT TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.vagas v JOIN public.empresas e ON e.id = v.empresa_id
            WHERE v.id = vaga_id AND v.status='Aberta' AND e.ativo)
  );

CREATE POLICY "cand auth inscreve" ON public.candidatos_televendas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.vagas v JOIN public.empresas e ON e.id = v.empresa_id
            WHERE v.id = vaga_id AND v.status='Aberta' AND e.ativo)
  );

CREATE POLICY "cand scope select" ON public.candidatos_televendas FOR SELECT TO authenticated
  USING (
    (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
    AND public.user_has_perm('ver_candidatos')
  );

CREATE POLICY "cand scope update" ON public.candidatos_televendas FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
  WITH CHECK (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id));

-- ============= 11. RLS: diversidade =============
DROP POLICY IF EXISTS "Qualquer um envia diversidade (anon)" ON public.diversidade_candidatos;
DROP POLICY IF EXISTS "Qualquer um envia diversidade (auth)" ON public.diversidade_candidatos;
DROP POLICY IF EXISTS "Recrutadores leem diversidade" ON public.diversidade_candidatos;

CREATE POLICY "div anon insere" ON public.diversidade_candidatos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "div auth insere" ON public.diversidade_candidatos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "div scope select" ON public.diversidade_candidatos FOR SELECT TO authenticated
  USING (
    (public.is_super_admin()
     OR (empresa_id IS NOT NULL AND public.user_can_access_unidade(empresa_id, unidade_id))
     OR empresa_id IS NULL)
    AND public.user_has_perm('ver_diversidade')
  );

-- ============= 12. RLS: empresas / unidades =============
CREATE POLICY "emp anon lê ativas" ON public.empresas FOR SELECT TO anon USING (ativo);

CREATE POLICY "emp scope select" ON public.empresas FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.current_user_empresa());

CREATE POLICY "emp super escreve" ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "emp super atualiza" ON public.empresas FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "emp super deleta" ON public.empresas FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "un anon lê" ON public.unidades FOR SELECT TO anon
  USING (EXISTS(SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND e.ativo));

CREATE POLICY "un scope select" ON public.unidades FOR SELECT TO authenticated
  USING (public.is_super_admin() OR empresa_id = public.current_user_empresa());

CREATE POLICY "un admin insere" ON public.unidades FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (empresa_id = public.current_user_empresa() AND public.user_has_perm('gerenciar_usuarios'))
  );
CREATE POLICY "un admin atualiza" ON public.unidades FOR UPDATE TO authenticated
  USING (public.is_super_admin()
         OR (empresa_id = public.current_user_empresa() AND public.user_has_perm('gerenciar_usuarios')))
  WITH CHECK (public.is_super_admin()
         OR (empresa_id = public.current_user_empresa() AND public.user_has_perm('gerenciar_usuarios')));
CREATE POLICY "un admin deleta" ON public.unidades FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ============= 13. RLS: usuarios =============
CREATE POLICY "usr lê própria linha" ON public.usuarios FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "usr super lê tudo" ON public.usuarios FOR SELECT TO authenticated
  USING (public.is_super_admin());
CREATE POLICY "usr admin lê empresa" ON public.usuarios FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_user_empresa()
    AND public.user_has_perm('gerenciar_usuarios')
  );

CREATE POLICY "usr super escreve" ON public.usuarios FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "usr super atualiza" ON public.usuarios FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "usr super deleta" ON public.usuarios FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "usr admin insere empresa" ON public.usuarios FOR INSERT TO authenticated
  WITH CHECK (
    role <> 'super_admin'
    AND empresa_id = public.current_user_empresa()
    AND public.user_has_perm('gerenciar_usuarios')
  );
CREATE POLICY "usr admin atualiza empresa" ON public.usuarios FOR UPDATE TO authenticated
  USING (
    role <> 'super_admin'
    AND empresa_id = public.current_user_empresa()
    AND public.user_has_perm('gerenciar_usuarios')
  )
  WITH CHECK (
    role <> 'super_admin'
    AND empresa_id = public.current_user_empresa()
    AND public.user_has_perm('gerenciar_usuarios')
  );

-- ============= 14. RLS: usuario_unidades =============
CREATE POLICY "uu scope select" ON public.usuario_unidades FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.usuarios u
               WHERE u.id = usuario_id AND u.empresa_id = public.current_user_empresa())
  );
CREATE POLICY "uu scope insere" ON public.usuario_unidades FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      EXISTS (SELECT 1 FROM public.usuarios u
              WHERE u.id = usuario_id AND u.empresa_id = public.current_user_empresa())
      AND public.user_has_perm('gerenciar_usuarios')
    )
  );
CREATE POLICY "uu scope deleta" ON public.usuario_unidades FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      EXISTS (SELECT 1 FROM public.usuarios u
              WHERE u.id = usuario_id AND u.empresa_id = public.current_user_empresa())
      AND public.user_has_perm('gerenciar_usuarios')
    )
  );

-- ============= 15. STORAGE: currículos namespaced por empresa =============
-- Remove policies antigas se existirem
DROP POLICY IF EXISTS "Curriculos upload anon" ON storage.objects;
DROP POLICY IF EXISTS "Curriculos upload auth" ON storage.objects;
DROP POLICY IF EXISTS "Curriculos download recrutador" ON storage.objects;
DROP POLICY IF EXISTS "Curriculos read scope" ON storage.objects;

-- Upload por anon e auth (rota pública grava em qualquer subpasta da empresa via formulário)
CREATE POLICY "cv upload anon" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'curriculos');
CREATE POLICY "cv upload auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'curriculos');

-- Leitura limitada ao escopo do usuário (caminho começa com {empresa_id}/...)
CREATE POLICY "cv read scope" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'curriculos'
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = auth.uid() AND u.ativo
          AND u.empresa_id::text = (storage.foldername(name))[1]
      )
    )
  );
