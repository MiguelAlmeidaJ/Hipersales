# HiperSales — monorepo pnpm

Backend NestJS/TypeScript, PostgreSQL + Prisma, frontend Next.js e integração Evolution API.

## Estrutura

- `apps/api`: API NestJS e migrations Prisma 7 (fonte oficial do banco)
- `apps/web`: frontend Next.js
- `packages/contracts`: contratos Zod/TypeScript compartilhados
- `infra/docker`: infraestrutura Docker

`packages/database` contém um pacote antigo com Prisma 6 e **não faz parte do workspace ativo**. Não rode migrations nele.

## Primeira instalação

Requer Node.js >= 22 e Corepack habilitado:

```bash
corepack enable
pnpm install
```

**Importante:** a primeira instalação gera `pnpm-lock.yaml`. Versione esse arquivo com `git add pnpm-lock.yaml && git commit -m "build: add pnpm lockfile"`. A partir daí, CI e produção podem usar `pnpm install --frozen-lockfile`. Não misture `npm install` ou `npm ci` com pnpm.

Configure os arquivos .env conforme as instruções da API antes de rodar Prisma.

## Comandos centralizados (sempre da raiz)

| Comando | Ação |
|---|---|
| `pnpm dev` | Inicializa API e Web em paralelo, compilando os contratos antes |
| `pnpm dev:api` | Inicia apenas a API |
| `pnpm dev:web` | Inicia apenas o Next.js |
| `pnpm build` | Compila contratos, API e Web |
| `pnpm build:api` | Compila contratos e API |
| `pnpm build:web` | Compila contratos e Web |
| `pnpm typecheck` | Verifica API e Web |
| `pnpm test` | Testes da API |
| `pnpm prisma:generate` | Gera cliente Prisma da API |
| `pnpm prisma:migrate` | Aplica migrations pendentes (não apaga dados) |
| `pnpm format` / `pnpm format:check` | Formatação do Web |
| `pnpm infra:up` / `pnpm infra:down` | Sobe / derruba serviços Docker |
| `pnpm infra:ps` | Lista serviços Docker |
| `pnpm pm2:reload` | Recarrega os processos de produção |

## Atualização de produção

```bash
git pull origin main
corepack enable
pnpm install
pnpm prisma:migrate
pnpm build
pnpm pm2:reload
```

Preserve o `.env` e faça backup do banco antes de migrations em produção. Depois que o lockfile for versionado, use `pnpm install --frozen-lockfile`.

O Docker Compose executa PostgreSQL, Evolution API e Redis. API em 127.0.0.1:8000, Web em 127.0.0.1:3000 e Evolution em 127.0.0.1:8081. Use proxy reverso TLS e não exponha PostgreSQL/Redis/Evolution publicamente.

Os endpoints `/api/*` e os dados persistidos permanecem intactos.
