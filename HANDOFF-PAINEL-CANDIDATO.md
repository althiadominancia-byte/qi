# Handoff — Painel do Candidato

> Documento para uma **sessão paralela** trabalhar o Painel do Candidato sem depender do histórico
> da outra conversa. Leia isto + o `CLAUDE.md` antes de mexer. Tudo em **português** (idioma do produto).

## 0. Estado do ambiente (já configurado, NÃO refazer)

- **Backend Supabase próprio já no ar** (desacoplado do Lovable). Ref do projeto: `hbumgtsnvwcugfwytuxq`, em `supabase/config.toml`.
- **As 23 migrations já foram aplicadas** nesse projeto (schema 100% de pé, validado).
- **`.env.local`** (gitignored) já tem todas as chaves reais: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*`, `ANTHROPIC_API_KEY`, `LIVEKIT_*`. **Nunca commitar/ecoar esses valores.** O `.env` versionado só tem valores públicos.
- **IA = Anthropic direto** (`callClaude` em `src/lib/recrutamento.functions.ts`, modelo `claude-opus-4-8`). Não é mais o Lovable Gateway.
- **Vídeo = LiveKit Cloud** (entrevista). **Regra:** ler `process.env` **dentro** dos handlers (Cloudflare vincula env por request).
- Dev server: `bun run dev` → `http://localhost:5173/`.
- **1º super_admin** já criado: `althiadominancia@gmail.com` (linha em `public.usuarios` com role `super_admin`, empresa nula). Demais usuários são criados pelo app.
- **Restrições fixas do dono:** trabalhar tudo local; **não** aplicar nada no ambiente Lovable; não digitar senhas/credenciais por ele.

## 1. Arquitetura (resumo — detalhe no CLAUDE.md)

TanStack Start (SSR) + Router (file-based, segmentos `$`) + React 19 + TanStack Query + Tailwind v4 + shadcn + Supabase + Zod. Deploy Cloudflare Workers via nitro.

- **Lógica de servidor = `createServerFn`** (`src/lib/*.functions.ts`), padrão:
  `.middleware([requireSupabaseAuth]).inputValidator(zod.parse).handler`. Chame do cliente com `useServerFn`.
- **Clientes Supabase:** `supabase` (browser, anon, RLS) · `supabaseAdmin` (service-role, **ignora RLS**, só no servidor, `import` dentro do handler) · `context.supabase` (escopo do usuário).
- **Isolamento multi-tenant** é feito **em código** (porque `supabaseAdmin` ignora RLS) via `src/lib/tenant.server.ts`: `carregarUsuario`, `assertPerm`, `assertEscopoCandidato/Vaga/...`, `empresaFeatures`.
- **RBAC em dois planos:** Gestão do SaaS (`super_admin`) × Uso da aplicação (`admin_empresa`/`recrutador`/`visualizador`). Detalhe no CLAUDE.md.
- **Planos/entitlements:** features por empresa (`empresas.plano_id` + override `empresas.features`), resolvidas por `resolveFeatures`/`useFeatures`. **REGRA (CLAUDE.md): todo módulo novo comercializável adiciona uma feature key em `src/lib/recrutamento/features.ts` e faz gating por entitlement, além do gating por permissão.**

## 2. O que JÁ existe do lado do candidato

### Rotas públicas (sem login — candidato é `anon` hoje)
- **`src/routes/c.$token.tsx`** — formulário público de inscrição (funil central, ~760 linhas). Steps:
  `intro → dados → curriculo → situacional → disc → diversidade → revisao → resultado`
  (situacional some se `vaga.usar_situacional` for falso). Salva progresso no `localStorage`.
- **`src/routes/e.$token.tsx`** — página pública da **entrevista**: termo de consentimento LGPD (voz/vídeo/imagem, finalidade, retenção 90 dias, decisão humana, revogável, opção "prefiro sem gravação") → botão "Entrar na sala" → `SalaVideo` (LiveKit, lazy). Resolve dados via RPC `get_entrevista_por_token`.
- **`src/routes/s.$code.tsx`** — short link: resolve `vagas.short_code` → `link_token` → `/c/$token`.

### Server functions (candidato)
- **`candidato.functions.ts`** — `atualizarCadastroCandidato`, `excluirCandidato`.
- **`passaporte.functions.ts`** — `getPassaporte`, `listCompetencias`, `salvarCompetenciaCandidato`, `removerCompetenciaCandidato`, `salvarExperiencia`, `removerExperiencia`, `salvarPreferencias`, `extrairPassaporte` (IA extrai competências/experiências do `cv_analise`+DISC, ancorado na taxonomia).
- **`entrevista.functions.ts`** — `agendarEntrevista`, `getEntrevistaDoCandidato`, `registrarConsentimento` (pública, por token), `emitirTokenSala` (recrutador), `emitirTokenSalaCandidato` (pública, exige consentimento), `registrarDecisaoEntrevista` (decisão HUMANA).
- **`qinmatch.functions.ts`** — `calcularMatch`, `getMatch` (compatibilidade candidato × vaga, explicável; motor em `src/lib/recrutamento/matching.ts`).
- **`jornada.functions.ts`** — transições de etapa do candidato.
- **`recrutamento.functions.ts`** — `analisarCv` (IA lê o PDF/imagem do CV), `gerarPerfilVaga`, `gerarFormularioVaga`.

### Componentes (hoje usados no painel do RECRUTADOR, em `admin.tsx` detalhe do candidato)
`PassaporteBloco.tsx`, `QinMatchBloco.tsx`, `EntrevistaBloco.tsx`, `SalaVideo.tsx`. **Reaproveitáveis** num painel do candidato.

### Tabelas de domínio do candidato
`candidatos_televendas` (cadastro + DISC + situacional + `cv_analise` + match), `diversidade_candidatos`,
`candidato_competencias`, `candidato_evidencias`, `candidato_experiencias`, `candidato_preferencias`,
`match_scores`, `entrevistas`, `entrevista_consentimentos`, `competencias` (taxonomia), `vaga_competencias`.
Helpers RLS: `is_recruiter`, `user_effective_perms`, `user_can_access_unidade`, `fill_tenant_from_candidato/vaga`.

## 3. ⚠️ A grande decisão de produto: qual é o "Painel do Candidato"?

Hoje **o candidato não tem login** — ele entra por link com token (`/c/$token`), preenche e some. Não há área autenticada dele. "Painel do candidato" pode significar coisas bem diferentes; **decidir isto primeiro** define todo o resto:

- **(A) Portal do candidato autenticado** — candidato cria conta (Supabase Auth) e acessa uma área própria: acompanhar candidaturas, status na jornada, ver/editar o **Passaporte de Talentos**, ver entrevistas agendadas e entrar na sala, currículo. → Precisa de **modelo de auth do candidato** (Supabase Auth separado dos usuários recrutadores; `candidatos_televendas` hoje não tem `user_id`), novas rotas (ex.: grupo `_candidato/`), RLS por "dono candidato", e uma migração ligando candidato ↔ auth user.
- **(B) "Painel" = a visão consolidada do candidato para o RECRUTADOR** — melhorar a tela de detalhe do candidato em `admin.tsx` (que já reúne Dados, Jornada, Perfil comportamental, QinMatch, Passaporte, Entrevista). → Sem auth nova; é refino de UI existente.
- **(C) Onboarding pós-inscrição sem conta** — após enviar o formulário, o candidato recebe um link/token persistente para acompanhar o andamento (sem senha). → Meio-termo; usa token, não Supabase Auth.

**Recomendação:** confirmar com o dono qual das três. Se for (A), a primeira entrega é a **migração de auth do candidato** + RLS, antes de qualquer UI. Reaproveitar `PassaporteBloco`/`EntrevistaBloco`/`QinMatchBloco` acelera muito qualquer opção.

## 4. Convenções que a sessão paralela DEVE respeitar

- Idioma **português** em UI, comentários e identificadores de domínio.
- **Não** confiar no cliente: server functions revalidam auth via `supabaseAdmin` + `user_effective_perms`.
- Isolar por tenant com `tenant.server.ts` (`assertEscopo*`) — risco de vazamento de PII entre empresas é o pesadelo do produto.
- **Todo módulo novo alimenta a tabela de planos** (feature key em `features.ts` + gating por entitlement) — regra no CLAUDE.md.
- LGPD: nada de decisão automatizada (Art. 20) — IA é apoio, decisão é humana e registrada; consentimento específico para gravação de entrevista.
- Tipos do Supabase (`src/integrations/supabase/types.ts`) ainda **não** têm as tabelas novas (branding/planos/passaporte/qinmatch/entrevistas) → o código usa casts `as any` em `.from("tabela" as any)`. Regenerar com `supabase gen types` depois de linkar reduz isso (backlog).
- **Não** editar `routeTree.gen.ts`, `vite.config.ts` (plugins), nem os arquivos "automatically generated" à mão.

## 5. Pendências abertas (para não colidir entre sessões)

- **[Em andamento na sessão principal]** QinMatch — caminho rico de competências da vaga: ancorar `gerarPerfilVaga` na taxonomia, capturar `peso` + `nivel_min`, gravar `vaga_competencias` ao salvar a vaga, e UI no `ConstrutorVaga` (`admin.tsx`). **A sessão do candidato NÃO deve mexer em `admin.tsx` ConstrutorVaga / `gerarPerfilVaga` / `qinmatch` para evitar conflito.**
- Regenerar `types.ts` (precisa Personal Access Token do Supabase).
- Entrevista Fase 2 (transcrição + análise de conteúdo por IA) — backlog.

## 6. Como rodar / validar rápido

```bash
bun run dev            # http://localhost:5173/
# login: althiadominancia@gmail.com (super_admin). Demais usuários pelo app.
```
Formulário público de teste: crie uma vaga no painel, pegue o `link_token` e abra `/c/<token>`.
