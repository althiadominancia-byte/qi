-- Vínculo de tenant obrigatório para papéis não-super.
--
-- Regra: só o super_admin é global (empresa_id nulo). admin_empresa, recrutador
-- e visualizador PRECISAM estar vinculados a uma empresa. A UI (modal de usuário)
-- e as server functions (admin-users) já enforçam; este CHECK é a garantia no
-- banco (defesa em profundidade).
--
-- NOT VALID: passa a valer para todo INSERT/UPDATE a partir de agora, sem validar
-- as linhas já existentes (evita falhar a migration por dado legado). Depois de
-- confirmar que não há violações, rode:
--   ALTER TABLE public.usuarios VALIDATE CONSTRAINT usuarios_empresa_obrigatoria_nao_super;

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_empresa_obrigatoria_nao_super;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_empresa_obrigatoria_nao_super
  CHECK (role = 'super_admin' OR empresa_id IS NOT NULL)
  NOT VALID;
