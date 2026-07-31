-- Cadastro Neutro: o perfil pertence ao PROFISSIONAL (conta), não à vaga.
-- Empresas nunca leem estas tabelas — só recebem PROJEÇÕES nas candidaturas.
-- A classificação contra vagas é papel do motor de match (diretriz do dono).

CREATE TABLE IF NOT EXISTS public.conta_perfil (
  conta_id       uuid PRIMARY KEY REFERENCES public.candidato_contas(id) ON DELETE CASCADE,
  respostas      jsonb NOT NULL DEFAULT '{}',
  resumo_ia      text,
  estruturado_em timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conta_competencias (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id       uuid NOT NULL REFERENCES public.candidato_contas(id) ON DELETE CASCADE,
  competencia_id uuid NOT NULL REFERENCES public.competencias(id) ON DELETE CASCADE,
  nivel          smallint NOT NULL DEFAULT 3 CHECK (nivel BETWEEN 1 AND 5),
  origem         text NOT NULL DEFAULT 'declarada' CHECK (origem IN ('declarada','ia')),
  confianca      real CHECK (confianca BETWEEN 0 AND 1),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, competencia_id)
);
CREATE INDEX IF NOT EXISTS idx_conta_comp_conta ON public.conta_competencias(conta_id);

CREATE TABLE IF NOT EXISTS public.conta_experiencias (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id         uuid NOT NULL REFERENCES public.candidato_contas(id) ON DELETE CASCADE,
  tipo             text NOT NULL DEFAULT 'formal' CHECK (tipo IN ('formal','informal','voluntariado','projeto','curso')),
  titulo           text NOT NULL,
  organizacao      text,
  inicio           date,
  fim              date,
  atual            boolean NOT NULL DEFAULT false,
  descricao        text,
  origem           text NOT NULL DEFAULT 'declarada' CHECK (origem IN ('declarada','ia')),
  confianca        real CHECK (confianca BETWEEN 0 AND 1),
  status_validacao text NOT NULL DEFAULT 'declarada' CHECK (status_validacao IN ('declarada','consistente_cv','pendente_confirmacao')),
  pendencia        text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conta_exp_conta ON public.conta_experiencias(conta_id);

CREATE TABLE IF NOT EXISTS public.conta_preferencias (
  conta_id        uuid PRIMARY KEY REFERENCES public.candidato_contas(id) ON DELETE CASCADE,
  disponibilidade text,
  pretensao_min   numeric,
  pretensao_max   numeric,
  modelo_trabalho text CHECK (modelo_trabalho IN ('presencial','hibrido','remoto','indiferente')),
  interesses      jsonb NOT NULL DEFAULT '[]',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS LIGADO, SEM POLICIES: acesso exclusivo via server fns (service-role).
-- Nem staff, nem anon, nem o próprio authenticated leem direto — privacidade
-- do marketplace (a empresa só vê o que for projetado na candidatura dela).
ALTER TABLE public.conta_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_competencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_experiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_preferencias ENABLE ROW LEVEL SECURITY;
