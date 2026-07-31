# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

SaaS de recrutamento e seleção da Distribuidora Estrela. Candidatos públicos se inscrevem por um formulário acessado via link com token, que captura avaliação DISC, questões situacionais, dados de diversidade e o currículo; o CV é analisado por um LLM e o candidato recebe uma nota de match contra uma vaga. Recrutadores gerenciam vagas, candidatos, líderes e a estrutura organizacional por um painel autenticado. A aplicação é **multi-tenant** (`empresas` → `unidades`), com acesso baseado em papéis e permissões. Textos de interface e código de domínio estão em **português** — mantenha esse idioma em strings visíveis ao usuário, comentários e identificadores.

Gerado/estruturado pelo Lovable (ver `@lovable.dev/vite-tanstack-config`); vários arquivos têm o aviso "automatically generated. Do not edit."

## Comandos

O gerenciador de pacotes é o **bun** (ver `bun.lock`, `bunfig.toml`).

```bash
bun install           # instala dependências (guarda anti supply-chain de 24h: ignora versões com < 1 dia)
bun run dev           # servidor de desenvolvimento (vite)
bun run build         # build de produção (nitro, mira Cloudflare por padrão)
bun run build:dev     # build em modo desenvolvimento
bun run preview       # pré-visualiza o build de produção
bun run lint          # eslint
bun run format        # prettier --write .
```

**Não há suíte de testes** nem runner de testes configurado.

## Arquitetura

**Stack:** TanStack Start (SSR) + TanStack Router (roteamento por arquivos) + React 19 + TanStack Query, Tailwind v4, shadcn/ui (estilo new-york), Supabase (Postgres + Auth + Storage), Zod. Deploy em Cloudflare Workers via nitro.

### Roteamento
Baseado em arquivos, via TanStack Router — ver `src/routes/README.md` para as convenções (segmentos dinâmicos usam `$` puro, não `{}`). `src/routeTree.gen.ts` é gerado automaticamente; nunca edite à mão. Não crie `src/pages/` nem layouts no estilo Next/Remix. `src/routes/__root.tsx` é o único shell da aplicação — preserve seu `<Outlet />` e o `RootShell`.

Grupos de rotas:
- `_authenticated/` — painel do recrutador. `route.tsx` controla o acesso no `beforeLoad` (redireciona para `/auth` se não houver usuário Supabase) e renderiza o layout com a sidebar. `ssr: false`. Páginas: `admin` (vagas, o maior arquivo, ~2 mil linhas), `catalogo`, `lideres`, `niveis`, `permissoes`, `super` (empresas, só super-admin), `candidato.$id`, `previa.$id`.
- `c.$token.tsx` — formulário **público** de inscrição do candidato (o funil central, ~760 linhas: cadastro → currículo → situacional → DISC → diversidade → revisão).
- `s.$code.tsx` — redirecionamento de link curto: resolve `vagas.short_code` → `link_token` → `/c/$token`.
- `auth.tsx`, `definir-senha.tsx` — fluxos de autenticação.
- `api/public/hooks/avaliacoes.ts` — rota de servidor (cron) disparada pelo pg_cron; autenticada comparando o header `apikey` com a anon key.

### Lógica de servidor: `createServerFn`, não Edge Functions
A lógica de servidor fica em `src/lib/*.functions.ts` como handlers `createServerFn` do TanStack (estilo RPC), e **não** como Supabase Edge Functions. O corpo do `.handler` roda só no servidor e seus imports são removidos (tree-shaking) do bundle do cliente, mas o código a nível de módulo ainda vai para o cliente — coloque helpers exclusivamente de servidor em arquivos `*.server.ts` (regra imposta: importar `server-only` é erro no eslint). Chame a partir dos componentes via `useServerFn` / invocação direta: `await getGreeting({ data: { name } })`. Ver `src/lib/api/example.functions.ts` para o padrão canônico.

Convenção em toda server fn: `.middleware([requireSupabaseAuth])` → `.inputValidator(zodSchema.parse)` → `.handler`.

### Clientes Supabase — escolha o certo
- `@/integrations/supabase/client` (`supabase`) — cliente do navegador, anon/publishable key, sujeito ao RLS. Usado em componentes e rotas públicas.
- `@/integrations/supabase/client.server` (`supabaseAdmin`) — **service-role, ignora o RLS**. Só no servidor; importe *dentro* do corpo do handler (`const { supabaseAdmin } = await import(...)`). O controle de acesso é então feito manualmente no código (ver abaixo).
- `requireSupabaseAuth` (`auth-middleware.ts`) — middleware das server functions; valida o token Bearer e coloca `{ supabase, userId, claims }` no `context`. Esse `context.supabase` é um cliente **no escopo do usuário** (RLS se aplica).
- `attachSupabaseAuth` (`auth-attacher.ts`) — middleware de cliente registrado globalmente em `src/start.ts` que anexa o token Bearer a toda chamada de serverFn. Sem ele, a autenticação no servidor quebra.

`client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts` e `types.ts` são todos gerados automaticamente — evite editar à mão.

### Modelo de autorização
Duas camadas, ambas em português:
- **Papéis:** `super_admin` | `admin_empresa` | `recrutador` | `visualizador` (`usuarios.role`).
- **Permissões:** chaves granulares (`gerenciar_usuarios`, `gerenciar_vagas`, `ver_curriculo`, etc.). Permissões efetivas = padrão do papel da empresa (`permissoes_papel`) sobrescrito pelos overrides por usuário (`usuarios.perms`), resolvido pela RPC Postgres `user_effective_perms`. `super_admin` sempre tem tudo.

A lógica de permissões do frontend e os presets ficam em `src/lib/recrutamento/perms.ts` (`PERM_KEYS`, `PRESET`, `resolveEfetivas`, `hasPerm`). As server functions revalidam a autorização carregando o usuário via `supabaseAdmin` e chamando `user_effective_perms` — nunca confie no cliente. `getMyScope` (`scope.functions.ts`) retorna o `UserScope` completo (papel, empresa, acesso a unidades, permissões efetivas) usado para montar a sidebar e o gating da UI.

### Planos e entitlements (regra de plataforma)
Este é um **SaaS comercial multi-tenant**: o dono da plataforma (`super_admin`) vende acesso às empresas por **plano**. Cada plano liga/desliga **features** (entitlements). As chaves de feature ficam em `src/lib/recrutamento/features.ts` (`FEATURE_KEYS`, `FEATURE_LABELS`, `PLAN_PRESETS`, `resolveFeatures`); os planos são modelos na tabela `planos` e cada empresa aponta para um via `empresas.plano_id` (+ override esparso em `empresas.features`). Features efetivas = `plano.features` sobrescrito pelo override da empresa (`resolveFeatures`); o hook `useFeatures()` resolve isso na UI.

- **`/planos`** (só `super_admin`) configura os **modelos de plano** e quais features cada um libera. Ela **não** atribui plano a empresa.
- A **atribuição do plano a cada empresa** é feita em **Empresas & Unidades** (`/super`), na criação da empresa e no card dela.

**REGRA OBRIGATÓRIA — todo módulo novo alimenta a tabela de planos:** ao criar qualquer módulo/recurso comercializável (ex.: Passaporte, QinMatch, Entrevista IA), adicione uma **feature key** correspondente em `features.ts` (com label/desc e inclusão nos `PLAN_PRESETS`) e faça o **gating por entitlement** na UI e nas server functions, além do gating por permissão. Sem isso o módulo não pode ser vendido/controlado por plano. Módulo sem entitlement = bug de produto.

### Constantes de domínio e lógica de avaliação
`src/lib/recrutamento/data.ts` é a fonte da verdade para cores da marca, blocos DISC, questões situacionais e pontuação (`computeResults`). O cabeçalho avisa: **não altere o conteúdo do DISC/situacionais sem revisão do RH.** Os helpers de upload/compressão do currículo (no navegador) estão em `src/lib/recrutamento/cv-upload.ts`.

### IA / LLM
A análise de currículo e a geração de perfil de vaga chamam o **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions`, compatível com OpenAI) usando `LOVABLE_API_KEY`, a partir de `src/lib/recrutamento.functions.ts` (`analisarCv`, `gerarPerfilVaga`, `gerarFormularioVaga`). Não é a API da Anthropic.

### Banco de dados
O schema Postgres é gerenciado por migrations SQL em `supabase/migrations/`. Tabelas principais: `empresas`, `unidades`, `usuarios`, `usuario_unidades`, `permissoes_papel`, `vagas`, `candidatos_televendas`, `diversidade_candidatos`, `contratacoes`, `avaliacoes_experiencia`, `lideres`, `departamentos`, `setores`, `niveis_lideranca`. O RLS está habilitado com funções auxiliares (`has_role`, `is_recruiter`, `user_effective_perms`, `preset_perms`). Candidatos inserem como `anon`; recrutadores leem sob RLS.

## Convenções e pegadinhas

- **Alias de path:** `@/` → `src/`.
- **Variáveis de ambiente:** o servidor lê `process.env.SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` / `LOVABLE_API_KEY`; o cliente lê `import.meta.env.VITE_*`. No Cloudflare, o env é vinculado por requisição — leia `process.env` **dentro** de funções, nunca no escopo de módulo (`config.server.ts` explica isso).
- **Não mexa na configuração de plugins do `vite.config.ts`** — o `@lovable.dev/vite-tanstack-config` já registra tanstackStart, react, tailwind, tsConfigPaths, nitro, etc. Adicioná-los manualmente quebra a app com plugins duplicados.
- **Estilização:** boa parte da UI do candidato/painel usa objetos `style` inline com as constantes de cor de `data.ts`; os primitivos do shadcn/ui ficam em `src/components/ui/`. Adicione componentes shadcn via CLI (`components.json` configurado, base color slate, ícones lucide).
- O tratamento de erros envolve o SSR (`src/server.ts` normaliza 500s engolidos pelo h3) e reporta ao Lovable (`lib/lovable-error-reporting.ts`); a rota raiz define `NotFoundComponent`/`ErrorComponent`.
- `noUnusedLocals`/`noUnusedParameters` estão desativados; `@typescript-eslint/no-unused-vars` está desabilitado.
