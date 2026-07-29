-- QinMatch v1 — motor de compatibilidade multidimensional explicável.
-- Compara candidato × vaga em dimensões (competências, comportamental,
-- evidências, potencial, condições), reusando o Passaporte de Talentos e o
-- match comportamental (DISC) já existente. A camada semântica (pgvector) fica
-- preparada e é ativada quando o provedor de embeddings for definido.

-- ============= 1. pgvector (preparado para a busca semântica) =============
CREATE EXTENSION IF NOT EXISTS vector;

-- ============= 2. Competências exigidas pela vaga (lado da vaga da taxonomia) =============
CREATE TABLE IF NOT EXISTS public.vaga_competencias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  vaga_id       uuid NOT NULL REFERENCES public.vagas(id) ON DELETE CASCADE,
  competencia_id uuid NOT NULL REFERENCES public.competencias(id) ON DELETE CASCADE,
  empresa_id    uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id    uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  peso          text NOT NULL DEFAULT 'importante' CHECK (peso IN ('essencial','importante','desejavel')),
  nivel_min     smallint CHECK (nivel_min BETWEEN 1 AND 5),
  UNIQUE (vaga_id, competencia_id)
);
CREATE INDEX IF NOT EXISTS idx_vaga_comp_vaga ON public.vaga_competencias(vaga_id);
CREATE INDEX IF NOT EXISTS idx_vaga_comp_empresa ON public.vaga_competencias(empresa_id, unidade_id);

-- Deriva tenant da vaga (trigger).
CREATE OR REPLACE FUNCTION public.fill_tenant_from_vaga()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS NULL OR NEW.unidade_id IS NULL THEN
    SELECT v.empresa_id, v.unidade_id INTO NEW.empresa_id, NEW.unidade_id
      FROM public.vagas v WHERE v.id = NEW.vaga_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_fill_vaga_comp ON public.vaga_competencias;
CREATE TRIGGER trg_fill_vaga_comp BEFORE INSERT ON public.vaga_competencias
  FOR EACH ROW EXECUTE FUNCTION public.fill_tenant_from_vaga();

-- ============= 3. Resultado do match (com explicabilidade e versão) =============
CREATE TABLE IF NOT EXISTS public.match_scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  candidato_id    uuid NOT NULL REFERENCES public.candidatos_televendas(id) ON DELETE CASCADE,
  vaga_id         uuid NOT NULL REFERENCES public.vagas(id) ON DELETE CASCADE,
  empresa_id      uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id      uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  score_geral     smallint,                                   -- 0..100
  dimensoes       jsonb NOT NULL DEFAULT '{}'::jsonb,          -- {competencias, comportamental, evidencias, potencial, condicoes}
  explicacao      jsonb NOT NULL DEFAULT '{}'::jsonb,          -- {pontos_fortes[], lacunas[], o_que_validar[]}
  criterios       jsonb NOT NULL DEFAULT '{}'::jsonb,          -- pesos aplicados nesta versão
  versao_algoritmo text NOT NULL DEFAULT 'qinmatch-v1',
  UNIQUE (candidato_id, vaga_id)
);
CREATE INDEX IF NOT EXISTS idx_match_candidato ON public.match_scores(candidato_id);
CREATE INDEX IF NOT EXISTS idx_match_vaga ON public.match_scores(vaga_id);
CREATE INDEX IF NOT EXISTS idx_match_empresa ON public.match_scores(empresa_id, unidade_id);
DROP TRIGGER IF EXISTS trg_fill_match ON public.match_scores;
CREATE TRIGGER trg_fill_match BEFORE INSERT ON public.match_scores
  FOR EACH ROW EXECUTE FUNCTION public.fill_tenant_from_candidato();

-- ============= 4. RLS =============
ALTER TABLE public.vaga_competencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;

-- vaga_competencias: leitura sob escopo; escrita exige gerenciar_vagas.
DROP POLICY IF EXISTS "vaga_comp select" ON public.vaga_competencias;
CREATE POLICY "vaga_comp select" ON public.vaga_competencias FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id));
DROP POLICY IF EXISTS "vaga_comp write" ON public.vaga_competencias;
CREATE POLICY "vaga_comp write" ON public.vaga_competencias FOR ALL TO authenticated
  USING ((public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id)) AND public.user_has_perm('gerenciar_vagas'))
  WITH CHECK ((public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id)) AND public.user_has_perm('gerenciar_vagas'));

-- match_scores: leitura sob escopo (ver_candidatos); escrita sob escopo.
DROP POLICY IF EXISTS "match select" ON public.match_scores;
CREATE POLICY "match select" ON public.match_scores FOR SELECT TO authenticated
  USING ((public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id)) AND public.user_has_perm('ver_candidatos'));
DROP POLICY IF EXISTS "match write" ON public.match_scores;
CREATE POLICY "match write" ON public.match_scores FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id))
  WITH CHECK (public.is_super_admin() OR public.user_can_access_unidade(empresa_id, unidade_id));
