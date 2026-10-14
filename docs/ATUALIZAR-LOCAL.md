# Atualizar máquina local (Windows / PowerShell)

Antes de atualizar, confirme um backup restaurável do SQL Server e preserve o
`.env` e `.env.infrastructure` fora do Git.

```powershell
git status
git pull --ff-only origin main
corepack enable
pnpm install --frozen-lockfile
pnpm infra:up
pnpm prisma:migrate:admin
pnpm build
pnpm test
pnpm typecheck
pnpm access:check
pm2 startOrReload ecosystem.config.cjs --update-env
```

Antes do comando de migration, confira se existe uma tentativa anterior falha com `pnpm --filter @hipersales/database migrate:admin -- status`. Se existir uma migration falha, confirme que a transação foi revertida e marque a tentativa como rolled-back com `pnpm --filter @hipersales/database migrate:admin -- resolve --rolled-back 20261014110000_single_tenant_roles`; depois execute `pnpm prisma:migrate:admin`. Nunca marque como aplicada sem verificação.\n\nO banco principal da API é definido por `SQLSERVER_DATABASE_URL`. O PostgreSQL
do Compose pertence exclusivamente à Evolution API; não reutilize suas
credenciais ou volume na API HiperSales.

Não execute `prisma db push` nem `docker compose down -v` em produção. Use as
migrations versionadas e valide backup/restauração antes do deploy.

Para a homologação destrutiva, use somente `TEST_DATABASE_URL`
apontando para um banco dedicado cujo nome termine em `_test` ou `_validation`.
Nunca use o banco operacional nesse teste.

Após a atualização, valide login, cadastros, pedidos, ocorrências, anexos, PDFs,
metas, dashboards, SMTP e Evolution API pelo frontend em `http://localhost:3111`.
