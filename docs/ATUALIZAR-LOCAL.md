# Atualizar máquina local (Windows / PowerShell)

Antes de atualizar, confirme um backup restaurável do SQL Server e preserve o
`.env` fora do Git.

```powershell
git status
git pull --ff-only origin main
corepack enable
pnpm install --frozen-lockfile
docker compose up -d
pnpm prisma:migrate
pnpm build
pnpm test
pnpm typecheck
pm2 startOrReload ecosystem.config.cjs --update-env
```

O banco principal da API é definido por `SQLSERVER_DATABASE_URL`. O PostgreSQL
do Compose pertence exclusivamente à Evolution API; não reutilize suas
credenciais ou volume na API HiperSales.

Não execute `prisma db push` nem `docker compose down -v` em produção. Use as
migrations versionadas e valide backup/restauração antes do deploy.

Para a homologação destrutiva, use somente `TEST_DATABASE_URL`
apontando para um banco dedicado cujo nome termine em `_test` ou `_validation`.
Nunca use o banco operacional nesse teste.

Após a atualização, valide login, cadastros, pedidos, ocorrências, anexos, PDFs,
metas, dashboards, SMTP e Evolution API pelo frontend em `http://localhost:3000`.
