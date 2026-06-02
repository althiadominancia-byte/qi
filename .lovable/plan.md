## Plano de correção QA

Vou corrigir o fluxo como problema de segurança e robustez, não só como ajuste pontual.

### Diagnóstico provável
- O formulário público pode estar sendo enviado com uma sessão já logada no navegador.
- Nesse caso, a política de cadastro em `candidatos_televendas` roda como `authenticated`, não como `anon`.
- A política atual valida a vaga consultando `vagas`, mas essa consulta fica sujeita às regras de acesso do usuário logado, então um link público pode falhar com `new row violates row-level security policy`.
- Também existe uma função para preencher `empresa_id` e `unidade_id` a partir da vaga, mas não há trigger ativa no banco; isso deixa o cadastro dependente demais do frontend.

### Correção no banco
- Criar/ajustar uma função segura para validar se a vaga aceita inscrições públicas:
  - vaga existe
  - status é `Aberta`
  - formulário está aprovado
  - empresa está ativa
- Recriar as políticas de cadastro público de `candidatos_televendas` para `anon` e `authenticated` usando essa função, sem depender da visibilidade da tabela `vagas` pelo usuário logado.
- Ativar um trigger antes do cadastro em `candidatos_televendas` para preencher automaticamente `empresa_id` e `unidade_id` com base em `vaga_id`.
- Alinhar a política de `diversidade_candidatos` com a mesma regra pública para evitar o mesmo tipo de erro no próximo passo do formulário.

### Correção no código
- Enviar `empresa_id` e `unidade_id` também no cadastro principal de `candidatos_televendas`, como redundância segura.
- Passar a tratar erro no insert de diversidade; hoje esse erro pode passar silenciosamente e mascarar a causa real.
- Manter o formulário público funcionando sem exigir login, mesmo se o navegador estiver com sessão autenticada.

### Validação
- Conferir as políticas finais de `candidatos_televendas`, `diversidade_candidatos`, `vagas` e storage.
- Validar que o cadastro principal aceita link público aberto/aprovado para usuários anônimos e usuários já logados.
- Confirmar que vagas fechadas, não aprovadas ou de empresa inativa continuam bloqueadas.