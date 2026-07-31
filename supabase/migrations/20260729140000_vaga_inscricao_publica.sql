-- Captação por LINK PÚBLICO, por vaga.
-- `aceita_inscricao_publica` liga/desliga o formulário público (/c/$token) desta vaga.
-- Default true = retrocompatível: vagas existentes continuam aceitando inscrição por link.
-- A oferta desse recurso à empresa é gated pela feature de plano `inscricao_publica`
-- (resolvida na aplicação); este flag é o controle fino por vaga.
ALTER TABLE public.vagas
  ADD COLUMN IF NOT EXISTS aceita_inscricao_publica boolean NOT NULL DEFAULT true;
