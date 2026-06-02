Plano para corrigir o problema certo: a análise não deve aparecer ao candidato; ela precisa aparecer completa no painel do recrutador.

1. Corrigir a causa principal do currículo não estar chegando ao backend
- O banco mostra inscrições recentes com `cv_nome_arquivo` preenchido, mas `cv_storage_path` vazio e `cv_analise` vazio.
- Isso indica que o formulário salvou apenas o nome do arquivo no rascunho local, mas no envio final não havia mais o objeto real do arquivo para fazer upload.
- Vou ajustar o formulário para nunca tratar um nome salvo em cache como currículo real.
- Se o candidato voltar ao formulário e o arquivo real não existir mais, o sistema vai pedir para anexar novamente antes de enviar.

2. Garantir que o upload do currículo seja obrigatório para gerar a análise
- Na etapa de currículo/revisão, o botão de envio só ficará disponível quando houver um arquivo real selecionado.
- No envio, se houver nome de currículo mas não houver arquivo real, o envio será bloqueado com mensagem clara para reanexar.
- Assim não serão criadas novas inscrições “sem currículo” por perda de cache/aba/navegador.

3. Corrigir a análise de PDF
- O fluxo atual tenta extrair texto do PDF no navegador; isso está certo.
- Vou impedir que PDF seja enviado para a IA como imagem quando a extração falhar, porque isso não funciona nesse gateway.
- Para PDFs com texto extraível, a análise será feita pelo texto extraído e salva no candidato.
- Para PDFs escaneados/sem texto extraível, o sistema vai informar que não conseguiu ler o conteúdo do PDF e não vai fingir uma análise completa.

4. Melhorar a aba Candidatos para o recrutador
- O painel do recrutador já tem o bloco de análise completa, mas ele só aparece quando `cv_analise` existe.
- Vou deixar mais explícito no detalhe do candidato quando faltar upload/análise, separando os casos:
  - currículo não foi anexado de fato;
  - currículo anexado, mas análise não disponível;
  - análise disponível, exibindo resumo, experiências, pontos fortes, lacunas, aderência e perguntas de entrevista.

5. Validar dados existentes
- As inscrições antigas que já foram criadas sem `cv_storage_path` não têm arquivo salvo para analisar agora.
- A correção garante que as próximas inscrições cheguem completas ao recrutador.