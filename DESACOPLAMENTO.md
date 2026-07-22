# Desacoplamento do Lovable → Supabase próprio + Cloudflare

Runbook para sair do Lovable Cloud e rodar em infra própria. O que já foi feito
no código está marcado ✅; o que depende de você (contas/chaves) está como ⏳.

## Visão geral

| Camada | Antes (Lovable) | Depois (próprio) | Status |
|---|---|---|---|
| IA | AI Gateway do Lovable (Gemini) | API da Anthropic (Claude, SDK oficial) | ✅ código |
| Banco/Auth | Supabase provisionado pelo Lovable | Supabase próprio | ⏳ você cria |
| Front/deploy | (Lovable) | Cloudflare Workers (nitro já mira isso) | ⏳ você configura |
| Build config | `@lovable.dev/vite-tanstack-config` | (opcional trocar depois) | ⚠️ por último |

Segredos ficam **só** no `.env.local` (ignorado pelo git via `*.local`). O `.env`
versionado tem apenas chaves públicas.

---

## 1. Supabase próprio

1. Crie um projeto novo no <https://supabase.com/dashboard>.
2. Instale/rode o CLI (não precisa instalar global):
   ```bash
   ! npx supabase login          # abre o navegador; cole o token
   ! npx supabase link --project-ref <REF_DO_PROJETO_NOVO>
   ```
3. Ajuste `supabase/config.toml` → `project_id = "<REF_DO_PROJETO_NOVO>"`.
4. Aplique **todas** as migrations (inclui auditoria de tenant, branding, vínculo
   de empresa, entrevistas e planos/entitlements):
   ```bash
   ! npx supabase db push
   ```
5. Regenere os tipos (some com os casts `as any` de branding/planos):
   ```bash
   ! npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
   ```
6. Preencha as variáveis (Project Settings → API):
   - No **`.env`** (público): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
     `SUPABASE_PROJECT_ID` e os espelhos `VITE_SUPABASE_*`.
   - No **`.env.local`** (segredo): `SUPABASE_SERVICE_ROLE_KEY`.
7. (Opcional) migrar dados do projeto antigo com `pg_dump`/`pg_restore` se quiser
   preservar empresas/usuários/candidatos reais.

Depois disso, o enforcement de planos/entitlements passa a valer de verdade
(hoje está permissivo por falta da migration aplicada), e as escritas locais
(criar usuário, etc.) funcionam.

## 2. IA (Anthropic)

- Pegue a chave em <https://console.anthropic.com/> → API Keys.
- Cole no `.env.local`: `ANTHROPIC_API_KEY=...`
- Modelo usado: `claude-opus-4-8` (em `src/lib/recrutamento.functions.ts`).

## 3. Cloudflare (deploy do front)

O nitro já mira Cloudflare Workers (via a config de build). Para publicar:

```bash
! bun run build                 # build de produção (nitro → Cloudflare)
! npx wrangler login
```

Configure os segredos no ambiente do Worker (não no `.env`):
```bash
! npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
! npx wrangler secret put ANTHROPIC_API_KEY
# SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY podem ir como vars públicas do Worker
```
Depois, `wrangler deploy` (ou o comando que o preset nitro gerar em `.output`).

## 4. Sincronizar dependências

Usei `npm` para instalar o `@anthropic-ai/sdk` porque o `bun` não estava na
máquina; isso divergiu o `node_modules` do `bun.lock`. Ressincronize:
```bash
! bun install
```

## 5. (Por último, opcional) Trocar o build-config do Lovable

`vite.config.ts` usa `@lovable.dev/vite-tanstack-config`, que embute tanstackStart,
react, tailwind, tsconfig-paths e o nitro (target Cloudflare). Trocar por plugins
explícitos é a última etapa e a mais arriscada — exige recriar tudo à mão e um
`bun run build` completo para validar. Só vale fazer depois que Supabase +
Cloudflare + IA estiverem de pé. Não é necessário para a independência de dados/
hospedagem (essa vem das etapas 1–3).

---

## Checklist rápido

- [ ] Projeto Supabase novo criado
- [ ] `supabase link` + `db push` (migrations aplicadas)
- [ ] `gen types` (types.ts regenerado)
- [ ] `.env` + `.env.local` preenchidos (Supabase)
- [ ] `ANTHROPIC_API_KEY` no `.env.local`
- [ ] `bun install` (ressincroniza lock)
- [ ] `bun run build` + `wrangler deploy` (Cloudflare)
- [ ] (opcional) trocar `@lovable.dev/vite-tanstack-config`
