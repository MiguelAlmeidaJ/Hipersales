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

## Validacao local apos estabilizar a main

Em PowerShell, confira `git status` e mantenha seu `.env` fora do Git. Confira que `DATABASE_URL` aponta para o banco `hipersales` local (e nao para `hipersales_test`) e que `HIPERSALES_DB_PASSWORD` coincide com a senha do volume PostgreSQL ja inicializado. Se a porta 5432 estiver ocupada por outro servidor, ajuste o mapeamento de porta no Compose e a URL no `.env`; nao remova o volume para trocar senhas.

```powershell
git status
git pull --ff-only origin main
npm ci
npm ci --prefix apps/web
docker compose up -d hipersales-postgres
docker compose ps
npm run prisma:migrate --workspace @hipersales/api
npm run build:api
npm run test:api
npm run typecheck
npm run build --prefix apps/web
```

Depois de passar em tudo, execute `npm run dev --workspace @hipersales/api` e, em outro terminal, `npm run dev --prefix apps/web`. Acesse `http://localhost:3000` para testar login, cadastros, pedidos, ocorrencias, PDF, anexos e metas. O teste PostgreSQL integrado que recria o schema so deve receber `TEST_DATABASE_URL` apontando para um banco **dedicado** terminado em `_test` ou `_validation`: nunca o banco operacional.

O Postgres do HiperSales usa `127.0.0.1:5432` por padrao para permitir conexao de processos Node executados fora dos containers. Nao publique essa porta na rede. SMTP e Evolution precisam de credenciais e homologacao separadas; os testes unitarios nao comprovam entrega real.
