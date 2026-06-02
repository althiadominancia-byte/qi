
-- Função que valida se a vaga aceita inscrições públicas (security definer, ignora RLS)
CREATE OR REPLACE FUNCTION public.vaga_aceita_inscricao(_vaga_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vagas v
    LEFT JOIN public.empresas e ON e.id = v.empresa_id
    WHERE v.id = _vaga_id
      AND v.status = 'Aberta'
      AND COALESCE(v.formulario_aprovado, false)
      AND COALESCE(e.ativo, false)
  );
$$;

-- Trigger function: preenche empresa_id/unidade_id no insert de candidatos_televendas
CREATE OR REPLACE FUNCTION public.fill_candidato_televendas_from_vaga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_emp uuid; v_un uuid;
BEGIN
  IF NEW.vaga_id IS NULL THEN
    RAISE EXCEPTION 'vaga_id é obrigatório';
  END IF;
  SELECT v.empresa_id, v.unidade_id INTO v_emp, v_un
    FROM public.vagas v WHERE v.id = NEW.vaga_id;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'vaga não encontrada';
  END IF;
  NEW.empresa_id := v_emp;
  NEW.unidade_id := v_un;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_candidato_televendas ON public.candidatos_televendas;
CREATE TRIGGER trg_fill_candidato_televendas
BEFORE INSERT ON public.candidatos_televendas
FOR EACH ROW EXECUTE FUNCTION public.fill_candidato_televendas_from_vaga();

-- Substituir políticas de INSERT em candidatos_televendas para usar a função security definer
DROP POLICY IF EXISTS "cand anon inscreve" ON public.candidatos_televendas;
DROP POLICY IF EXISTS "cand auth inscreve" ON public.candidatos_televendas;

CREATE POLICY "cand anon inscreve"
ON public.candidatos_televendas
FOR INSERT
TO anon
WITH CHECK (public.vaga_aceita_inscricao(vaga_id));

CREATE POLICY "cand auth inscreve"
ON public.candidatos_televendas
FOR INSERT
TO authenticated
WITH CHECK (public.vaga_aceita_inscricao(vaga_id));

-- Mesma lógica para diversidade_candidatos
DROP POLICY IF EXISTS "div anon insere" ON public.diversidade_candidatos;
DROP POLICY IF EXISTS "div auth insere" ON public.diversidade_candidatos;

CREATE POLICY "div anon insere"
ON public.diversidade_candidatos
FOR INSERT
TO anon
WITH CHECK (
  vaga_id IS NOT NULL
  AND public.vaga_aceita_inscricao(vaga_id)
);

CREATE POLICY "div auth insere"
ON public.diversidade_candidatos
FOR INSERT
TO authenticated
WITH CHECK (
  vaga_id IS NOT NULL
  AND public.vaga_aceita_inscricao(vaga_id)
);
