# HiperSales — monorepo

Aplicação com backend NestJS/TypeScript, PostgreSQL via Prisma, frontend Next.js e integração com a Evolution API.

## Estrutura

- `apps/api/src/`: API NestJS, repositórios, documentos e jobs.
- `apps/api/prisma/`: schema e migrations PostgreSQL versionadas.
- `apps/web/`: frontend Next.js executado pelo PM2.
- `packages/contracts/`: schemas Zod e tipos TypeScript compartilhados.
- `infra/docker/`: infraestrutura em containers.

## Desenvolvimento local

Consulte `apps/api/README.md` e `apps/web/README.md`. Configure `DATABASE_URL` e preserve o `.env` antes de atualizar uma instalação existente.

```bash
npm ci
npm ci --prefix apps/web
npm run prisma:migrate --workspace @hipersales/api
npm run build:api
npm run build --prefix apps/web
pm2 startOrReload ecosystem.config.cjs
```

O Docker Compose executa PostgreSQL, Evolution API e Redis:

```bash
docker compose config
docker compose up -d
```

A API escuta em `127.0.0.1:8000`, o Web em `127.0.0.1:3000` e a Evolution em `127.0.0.1:8081`. Use proxy reverso com TLS e não exponha PostgreSQL, Redis ou o painel da Evolution diretamente na internet.

## Compatibilidade

Foram preservados os endpoints `/api/*`, o formato de sessão, o frontend e os dados migrados. O runtime da API usa exclusivamente PostgreSQL/Prisma.
