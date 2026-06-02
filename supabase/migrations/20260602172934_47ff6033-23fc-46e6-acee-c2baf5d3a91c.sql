
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'recrutador');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_recruiter(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','recrutador'));
$$;

-- Candidatos
CREATE TABLE public.candidatos_televendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  celular TEXT NOT NULL,
  endereco TEXT,
  setor_atual TEXT,
  tempo_empresa TEXT,
  experiencia_texto TEXT,
  motivacao_texto TEXT,
  cv_storage_path TEXT,
  cv_nome_arquivo TEXT,
  disc_respostas JSONB NOT NULL DEFAULT '{}'::JSONB,
  disc_pontuacao JSONB NOT NULL DEFAULT '{}'::JSONB,
  situacionais JSONB NOT NULL DEFAULT '{}'::JSONB,
  postura_score INT,
  perfil_key TEXT,
  perfil_nome TEXT,
  match_final INT,
  match_label TEXT,
  cv_analise JSONB,
  lgpd_aceite BOOLEAN NOT NULL DEFAULT false
);

GRANT INSERT ON public.candidatos_televendas TO anon;
GRANT SELECT, INSERT, UPDATE ON public.candidatos_televendas TO authenticated;
GRANT ALL ON public.candidatos_televendas TO service_role;

ALTER TABLE public.candidatos_televendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode se inscrever (anon)" ON public.candidatos_televendas
FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Qualquer um pode se inscrever (auth)" ON public.candidatos_televendas
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Recrutadores leem candidatos" ON public.candidatos_televendas
FOR SELECT TO authenticated USING (public.is_recruiter(auth.uid()));

CREATE POLICY "Recrutadores atualizam candidatos (cv_analise)" ON public.candidatos_televendas
FOR UPDATE TO authenticated USING (public.is_recruiter(auth.uid()));

-- Diversidade (isolada)
CREATE TABLE public.diversidade_candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raca TEXT,
  genero TEXT,
  orientacao TEXT,
  pcd TEXT,
  politico TEXT
);

GRANT INSERT ON public.diversidade_candidatos TO anon;
GRANT SELECT, INSERT ON public.diversidade_candidatos TO authenticated;
GRANT ALL ON public.diversidade_candidatos TO service_role;

ALTER TABLE public.diversidade_candidatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um envia diversidade (anon)" ON public.diversidade_candidatos
FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Qualquer um envia diversidade (auth)" ON public.diversidade_candidatos
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Recrutadores leem diversidade" ON public.diversidade_candidatos
FOR SELECT TO authenticated USING (public.is_recruiter(auth.uid()));
