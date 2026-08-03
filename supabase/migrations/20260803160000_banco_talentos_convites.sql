-- Banco de Talentos + Convites (diretriz do dono, 2026-08-03):
-- o candidato NÃO se candidata espontaneamente — a empresa encontra o fit no
-- pool (perfis às cegas) e MANDA O CONVITE; o aceite cria a candidatura.

-- Consentimento explícito do titular para aparecer no pool (fail-closed).
ALTER TABLE public.candidato_contas
  ADD COLUMN IF NOT EXISTS visivel_pool boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.convites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  vaga_id       uuid NOT NULL REFERENCES public.vagas(id) ON DELETE CASCADE,
  conta_id      uuid NOT NULL REFERENCES public.candidato_contas(id) ON DELETE CASCADE,
  enviado_por   uuid,                 -- auth.users.id do recrutador
  mensagem      text,
  match_score   numeric,              -- preenchido pelo motor quando disponível
  status        text NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','aceito','recusado','cancelado')),
  candidato_id  uuid REFERENCES public.candidatos_televendas(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  respondido_em timestamptz,
  UNIQUE (vaga_id, conta_id)
);
CREATE INDEX IF NOT EXISTS idx_convites_conta ON public.convites(conta_id, status);
CREATE INDEX IF NOT EXISTS idx_convites_vaga ON public.convites(vaga_id);

-- Mesmo regime das tabelas do titular: RLS ligado, SEM policies —
-- todo acesso via server functions (service-role) com checks de escopo.
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

-- ============= Seed nos planos padrão (sem sobrescrever ajuste manual) =============
UPDATE public.planos SET features = features || '{"banco_talentos": true}'::jsonb
 WHERE id IN ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0002-000000000003')
   AND NOT (features ? 'banco_talentos');

UPDATE public.planos SET features = features || '{"banco_talentos": false}'::jsonb
 WHERE id = '00000000-0000-0000-0002-000000000001'
   AND NOT (features ? 'banco_talentos');
