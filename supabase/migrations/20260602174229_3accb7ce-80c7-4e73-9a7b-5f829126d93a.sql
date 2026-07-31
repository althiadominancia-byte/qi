-- Seed do recrutador original (conta Lovable). Só insere se o usuário existir
-- no auth.users; num projeto novo não há esse usuário e o seed é ignorado.
INSERT INTO public.user_roles (user_id, role)
SELECT 'bb83cc8b-919b-4412-8be8-770f3aedbcce', 'recrutador'::public.app_role
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'bb83cc8b-919b-4412-8be8-770f3aedbcce')
ON CONFLICT DO NOTHING;