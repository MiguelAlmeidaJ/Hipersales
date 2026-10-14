# HiperSales — monorepo pnpm

Backend NestJS/TypeScript, SQL Server + Prisma, frontend Next.js e integração Evolution API.

O produto opera exclusivamente para a organização HiperMix, com os perfis `dev`, `admin` e `seller`. A política está documentada em [`docs/access-control.md`](docs/access-control.md).

## Estrutura

- `apps/api`: API NestJS (consome `@hipersales/database`)
- `apps/web`: frontend Next.js
- `apps/mobile`: aplicativo Expo/React Native para Android e iOS
- `packages/contracts`: contratos Zod/TypeScript compartilhados
- `packages/database`: schema único Prisma 7, migrations e Prisma Client compartilhado
- `infra/docker`: infraestrutura Docker

**Fonte única do banco:** `packages/database/prisma/schema.prisma`. As migrations ficam em `packages/database/prisma/migrations`, e a configuração da conexão em `packages/database/prisma.config.ts`. Não crie schemas adicionais nas aplicações.

## Primeira instalação

Requer Node.js >= 22 e Corepack habilitado:

```bash
corepack enable
pnpm install
```

**Importante:** a primeira instalação gera `pnpm-lock.yaml`. Versione esse arquivo com `git add pnpm-lock.yaml && git commit -m "build: add pnpm lockfile"`. A partir daí, CI e produção podem usar `pnpm install --frozen-lockfile`. Não misture `npm install` ou `npm ci` com pnpm.

Crie os ambientes a partir dos templates, sem misturar segredos do servidor com variáveis públicas do app:

- `.env.example` → `.env`: runtime da API, Web e integrações; usa o login SQL `hipersales_app`;
- `.env.infrastructure.example` → `.env.infrastructure`: senha administrativa do SQL Server e senha interna do PostgreSQL;
- `apps/mobile/.env.example` → `apps/mobile/.env.local`: somente valores públicos `EXPO_PUBLIC_*`.

Consulte [`docs/database.md`](docs/database.md) antes de rodar Prisma ou provisionar o usuário do banco.

## Comandos centralizados (sempre da raiz)

| Comando | Ação |
|---|---|
| `pnpm dev` | Inicializa API e Web em paralelo, compilando os contratos antes |
| `pnpm dev:api` | Inicia apenas a API |
| `pnpm dev:web` | Inicia apenas o Next.js |
| `pnpm dev:mobile` | Inicia o Expo para desenvolvimento mobile |
| `pnpm android` / `pnpm ios` | Abre o app mobile no emulador correspondente |
| `pnpm build` | Compila contratos, API e Web |
| `pnpm build:api` | Compila contratos, pacote database e API |
| `pnpm build:web` | Compila contratos e Web |
| `pnpm build:database` | Gera Prisma Client e compila o pacote compartilhado |
| `pnpm prisma:validate` | Valida o schema central |
| `pnpm typecheck` | Verifica API e Web |
| `pnpm test` | Testes da API |
| `pnpm prisma:generate` | Gera cliente Prisma da API |
| `pnpm prisma:migrate` | Aplica migrations pendentes (não apaga dados) |
| `pnpm prisma:migrate:admin` | Aplica migrations com credencial administrativa isolada |
| `pnpm format` / `pnpm format:check` | Formatação do Web |
| `pnpm infra:up` / `pnpm infra:down` | Sobe / derruba serviços Docker |
| `pnpm infra:ps` | Lista serviços Docker |
| `pnpm database:setup-user` | Cria/valida o login SQL de menor privilégio da aplicação |
| `pnpm env:check` / `pnpm env:check:local` | Valida os templates ou os arquivos locais sem exibir segredos |
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

O Docker Compose executa SQL Server para o HiperSales e PostgreSQL + Redis para a Evolution API. API em 127.0.0.1:3110, Web em 127.0.0.1:3111 e Evolution em 127.0.0.1:8081. Use proxy reverso TLS e não exponha bancos, Redis ou Evolution publicamente.

Os endpoints `/api/*` e os dados persistidos permanecem intactos.
