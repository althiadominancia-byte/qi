-- BUGFIX: candidato LOGADO no portal abria um link público de vaga e via
-- "Vaga não encontrada" — a leitura de `vagas` para authenticated era só do
-- staff. Detalhe traiçoeiro: uma policy com EXISTS em `empresas` NÃO funciona
-- para authenticated não-staff (o RLS de empresas o bloqueia no subquery).
-- Por isso usamos a função SECURITY DEFINER já existente vaga_aceita_inscricao
-- (vaga Aberta + formulário aprovado + empresa ativa), imune ao RLS aninhado.
-- Policies são permissivas (OR): o acesso do staff permanece inalterado.
DROP POLICY IF EXISTS "vagas auth lê (token)" ON public.vagas;
CREATE POLICY "vagas auth lê (token)"
ON public.vagas FOR SELECT TO authenticated
USING (public.vaga_aceita_inscricao(id));
