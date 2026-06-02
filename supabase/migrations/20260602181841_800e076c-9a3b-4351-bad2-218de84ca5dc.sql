-- Função updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Tabela vagas
CREATE TABLE public.vagas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  titulo text NOT NULL DEFAULT '',
  setor text NOT NULL DEFAULT '',
  modelo text NOT NULL DEFAULT 'Presencial',
  tipo text NOT NULL DEFAULT 'Efetivo',
  vagas integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'Rascunho',
  descricao text NOT NULL DEFAULT '',
  data_limite date,
  link_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  pesos jsonb NOT NULL DEFAULT '{"comunicador":50,"fechador":50,"diplomatico":50,"executor":50,"analitico":50}'::jsonb,
  habilidades jsonb NOT NULL DEFAULT '[]'::jsonb,
  competencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  experiencia text NOT NULL DEFAULT '',
  escolaridade text NOT NULL DEFAULT '',
  requisitos text NOT NULL DEFAULT '',
  usar_situacional boolean NOT NULL DEFAULT true,
  created_by uuid
);

GRANT SELECT ON public.vagas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vagas TO authenticated;
GRANT ALL ON public.vagas TO service_role;

ALTER TABLE public.vagas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon lê vagas" ON public.vagas FOR SELECT TO anon USING (true);
CREATE POLICY "Recrutadores leem vagas" ON public.vagas FOR SELECT TO authenticated USING (is_recruiter(auth.uid()));
CREATE POLICY "Recrutadores criam vagas" ON public.vagas FOR INSERT TO authenticated WITH CHECK (is_recruiter(auth.uid()));
CREATE POLICY "Recrutadores atualizam vagas" ON public.vagas FOR UPDATE TO authenticated USING (is_recruiter(auth.uid()));
CREATE POLICY "Recrutadores apagam vagas" ON public.vagas FOR DELETE TO authenticated USING (is_recruiter(auth.uid()));

CREATE TRIGGER vagas_updated_at BEFORE UPDATE ON public.vagas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- vaga_id em candidatos
ALTER TABLE public.candidatos_televendas
  ADD COLUMN vaga_id uuid REFERENCES public.vagas(id) ON DELETE SET NULL;

CREATE INDEX idx_candidatos_vaga ON public.candidatos_televendas(vaga_id);