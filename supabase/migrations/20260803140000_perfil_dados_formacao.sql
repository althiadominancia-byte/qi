-- Perfil neutro v2 (feedback do dono): dados pessoais mais relevantes
-- (celular/endereço na conta) e FORMAÇÃO como seção própria.

ALTER TABLE public.candidato_contas ADD COLUMN IF NOT EXISTS celular text;
ALTER TABLE public.candidato_contas ADD COLUMN IF NOT EXISTS endereco text;

CREATE TABLE IF NOT EXISTS public.conta_formacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id    uuid NOT NULL REFERENCES public.candidato_contas(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  instituicao text,
  ano         text,
  status      text NOT NULL DEFAULT 'concluido' CHECK (status IN ('cursando','concluido','incompleto')),
  origem      text NOT NULL DEFAULT 'declarada' CHECK (origem IN ('declarada','ia')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conta_form_conta ON public.conta_formacoes(conta_id);

-- Mesmo regime das demais conta_*: RLS ligado, SEM policies (só service-role).
ALTER TABLE public.conta_formacoes ENABLE ROW LEVEL SECURITY;
