-- Add per-vaga form questions
ALTER TABLE public.vagas
  ADD COLUMN IF NOT EXISTS disc_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS situacoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS formulario_aprovado boolean NOT NULL DEFAULT false;

-- Enforce: status Aberta exige formulario_aprovado
CREATE OR REPLACE FUNCTION public.validar_publicacao_vaga()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Aberta' AND COALESCE(NEW.formulario_aprovado, false) = false THEN
    RAISE EXCEPTION 'Não é possível publicar (status Aberta) sem aprovar o formulário da vaga.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validar_publicacao_vaga ON public.vagas;
CREATE TRIGGER trg_validar_publicacao_vaga
BEFORE INSERT OR UPDATE ON public.vagas
FOR EACH ROW EXECUTE FUNCTION public.validar_publicacao_vaga();

-- Atualiza trigger do candidato para também exigir formulário aprovado
CREATE OR REPLACE FUNCTION public.fill_candidato_from_vaga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_emp uuid; v_un uuid; v_status text; v_ativa boolean; v_aprov boolean;
BEGIN
  IF NEW.vaga_id IS NULL THEN
    RAISE EXCEPTION 'vaga_id é obrigatório';
  END IF;
  SELECT v.empresa_id, v.unidade_id, v.status, COALESCE(e.ativo, true), v.formulario_aprovado
    INTO v_emp, v_un, v_status, v_ativa, v_aprov
    FROM public.vagas v LEFT JOIN public.empresas e ON e.id = v.empresa_id
    WHERE v.id = NEW.vaga_id;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'vaga não encontrada';
  END IF;
  IF v_status <> 'Aberta' OR NOT v_ativa OR NOT COALESCE(v_aprov, false) THEN
    RAISE EXCEPTION 'vaga não está aberta para inscrições';
  END IF;
  NEW.empresa_id := v_emp;
  NEW.unidade_id := v_un;
  RETURN NEW;
END $$;