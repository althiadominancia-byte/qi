## Diagnóstico

A ficha do candidato no admin (`Detalhe` em `src/routes/_authenticated/admin.tsx`) **já tem** todos os blocos completos: perfil DISC, postura, match, currículo embutido (PDF/imagem/Word) e a Análise de IA com aderência, experiências, pontos fortes, lacunas e perguntas para entrevista.

O motivo de aparecer só o "perfil comportamental" no print é que as colunas `cv_storage_path` e `cv_analise` do registro estão `NULL`. A causa é a alteração que tirou os cards de análise da tela de sucesso do candidato:

- Antes: o candidato ficava parado na tela vendo a análise rodar — o `void rodarAnalise(...)` no `src/routes/c.$token.tsx` tinha tempo de terminar e gravar `cv_analise`.
- Agora: a tela mostra só "Inscrição enviada", o candidato fecha a aba, e a Promise do `analisarCv` (que roda no navegador) é abortada antes de chegar a fazer o `update cv_analise` no servidor. Resultado: análise nunca é persistida → bloco "Análise de currículo (IA)" some no admin.

Confirmação extra: o bloco "Currículo enviado" do admin só renderiza se `c.cv_storage_path` existir. Se o upload tiver falhado silenciosamente (ou o candidato não enviou arquivo), o card também não aparece — então também precisamos garantir que erros de upload não passem despercebidos.

## Plano de correção

1. **Tornar a análise síncrona no envio** (`src/routes/c.$token.tsx`)
   - No `enviarInscricao`, fazer `await rodarAnalise(...)` **antes** de chamar `setStep("resultado")`.
   - Mostrar um estado intermediário "Analisando seu currículo…" enquanto roda (sem expor o resultado ao candidato — apenas um spinner com texto neutro).
   - Se a análise falhar, ainda completar com sucesso (a inscrição já está gravada): só logar o erro e mostrar "Inscrição enviada" normalmente. O importante é não abortar a Promise por navegação prematura.

2. **Garantir que o upload de CV não seja silencioso**
   - Manter `throw upErr` (já existe), mas adicionar mensagem clara em `submitError` quando o upload falhar para o candidato refazer.
   - Validar que `arquivoCv` exista antes de tentar análise (já está).

3. **Pequeno ajuste no `Detalhe` do admin**
   - Quando `c.cv_storage_path` existir mas `c.cv_analise` ainda for `null` (ex.: inscrições antigas feitas durante a janela quebrada), mostrar um aviso curto "Análise de currículo não disponível para esta inscrição" no lugar do bloco de IA, para o recrutador entender o estado.
   - Sem mudanças no schema do banco.

4. **Backfill opcional (não obrigatório)**
   - Não vou mexer em dados existentes. As novas inscrições passam a gravar `cv_analise` corretamente. Caso queira reanalisar inscrições antigas, posso adicionar depois um botão "Reanalisar currículo" no `Detalhe` que chama `analisarCv` do admin.

## Arquivos tocados

- `src/routes/c.$token.tsx` — await da análise + estado "Analisando…".
- `src/routes/_authenticated/admin.tsx` — aviso quando `cv_analise` está ausente mas existe CV.

Sem migrations, sem mudanças em RLS, sem mudanças em server functions.