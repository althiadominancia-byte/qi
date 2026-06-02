
-- Função geradora de short_code de 6 caracteres (alfabeto sem ambíguos)
CREATE OR REPLACE FUNCTION public.gen_vaga_short_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'abcdefghjkmnpqrstuvwxyz23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.vagas WHERE short_code = code);
  END LOOP;
  RETURN code;
END $$;

ALTER TABLE public.vagas ADD COLUMN IF NOT EXISTS short_code text;
UPDATE public.vagas SET short_code = public.gen_vaga_short_code() WHERE short_code IS NULL;
ALTER TABLE public.vagas ALTER COLUMN short_code SET NOT NULL;
ALTER TABLE public.vagas ALTER COLUMN short_code SET DEFAULT public.gen_vaga_short_code();
CREATE UNIQUE INDEX IF NOT EXISTS vagas_short_code_unique ON public.vagas(short_code);
