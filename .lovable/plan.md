## Objetivo
Impedir que o candidato avance da etapa **Currículo** sem anexar de fato um arquivo. Hoje o botão "Continuar" está liberado sempre (`<Nav ... pode />`), o que permite seguir sem CV.

## Mudanças (apenas frontend, em `src/routes/c.$token.tsx`)

1. **Bloquear o botão Continuar na etapa "curriculo"**
   - Trocar `<Nav back={back} next={next} pode />` por `<Nav back={back} next={next} pode={!!cvPrep && !cvProcessando} aviso={!cvPrep ? "Anexe seu currículo para continuar." : (cvProcessando ? "Aguarde o processamento do arquivo..." : "")} />`.
   - Assim só libera quando há um `cvPrep` válido (arquivo real selecionado e processado).

2. **Incluir "curriculo" na regra `podeAvancar`** (defesa adicional, caso `Nav` seja acionado por Enter)
   - Em `podeAvancar`, adicionar: `if (step === "curriculo") return !!cvPrep && !cvProcessando;`.

3. **Reforçar visualmente que o campo é obrigatório**
   - Atualizar o rótulo do `<Campo>` para "Anexar currículo (PDF, Word ou imagem) *" e adicionar uma linha curta abaixo do dropzone: "Campo obrigatório — necessário para gerar sua análise."

## Fora de escopo
- Não mexer no backend, no fluxo de upload nem na análise de IA.
- Não alterar etapas seguintes (situacional, DISC, diversidade, revisão).
- A etapa "Revisão" já chama `enviarInscricao` que bloqueia envio sem arquivo; isso permanece como segunda camada.

## Resultado esperado
Na etapa **Currículo**, o botão "Continuar" fica desabilitado com a mensagem "Anexe seu currículo para continuar." até o candidato selecionar um arquivo válido. Só então ele consegue ir para Situacional/DISC/etc.
