-- Contratos portal ↔ motor (divisão de trabalho acordada em 2026-08-04):
-- 1) Vídeo é sinal do TALENTO (conta), reutilizável entre empresas.
-- 2) convites ganha status 'sugerido': o MOTOR escreve sugestões (vaga aberta
--    × talento acima do limiar) com match_score; a listagem do Banco de
--    Talentos consome SÓ isso — nunca o banco inteiro. Convidar = sugerido→pendente.

-- ============= 1. Vídeo em nível de conta =============
ALTER TABLE public.candidato_videos
  ADD COLUMN IF NOT EXISTS conta_id uuid REFERENCES public.candidato_contas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cand_videos_conta ON public.candidato_videos(conta_id);

-- Backfill: vídeos existentes herdam a conta da candidatura vinculada.
UPDATE public.candidato_videos cv
   SET conta_id = ct.conta_id
  FROM public.candidatos_televendas ct
 WHERE ct.id = cv.candidato_id
   AND cv.conta_id IS NULL
   AND ct.conta_id IS NOT NULL;

-- ============= 2. Status 'sugerido' nos convites (motor escreve) =============
ALTER TABLE public.convites DROP CONSTRAINT IF EXISTS convites_status_check;
ALTER TABLE public.convites ADD CONSTRAINT convites_status_check
  CHECK (status IN ('sugerido','pendente','aceito','recusado','cancelado'));
