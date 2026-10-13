# Atualizar máquina local (Windows / PowerShell)

Antes de atualizar, faça backup do PostgreSQL e das credenciais do ambiente. A branch de código não protege os dados do banco.

## Atualização segura

```powershell
git status
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npm ci --prefix apps/web
npm run prisma:migrate --workspace @hipersales/api
npm run build:api
npm run build --prefix apps/web
pm2 startOrReload ecosystem.config.cjs
```

Também é possível executar `powershell -ExecutionPolicy Bypass -File scripts/update-local.ps1`, que recusa atualizar uma pasta com alterações não salvas.

## Banco de dados

O PostgreSQL é a única base operacional da API. Não execute `prisma db push` nem `docker compose down -v` sobre dados de produção. Use somente as migrations versionadas e valide backup e restauração antes de uma atualização.

Para uma instalação nova:

```powershell
docker compose up -d hipersales-postgres
npm run prisma:migrate --workspace @hipersales/api
```

## Checklist de operação

1. [x] Relações, constraints e índices Prisma versionados.
2. [x] Dados importados e integridade validada.
3. [x] Controllers e services usando o repositório Prisma assíncrono.
4. [x] Endpoints de leitura, escrita, PDFs e isolamento homologados em PostgreSQL.
5. [x] Runtime legado removido.
6. [ ] Validar backup/restauração e credenciais no ambiente definitivo antes do deploy.
