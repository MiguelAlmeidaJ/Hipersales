# HiperSales — monorepo

Aplicação com backend NestJS/TypeScript, frontend Next.js e integração com a Evolution API.

## Estrutura

- `apps/api/src/`: API NestJS, documentos e jobs.
- `apps/web/`: frontend Next.js executado pelo PM2.
- `packages/contracts/`: schemas Zod e tipos TypeScript compartilhados.
- `infra/docker/`: arquivos da infraestrutura em containers.
- `scripts/`: utilitários de importação e relatórios.

## Desenvolvimento local

Consulte `apps/api/README.md` e `apps/web/README.md`. O banco local padrão fica em
`database/hypersales.sqlite3` e é ignorado pelo Git. Preserve esse arquivo e o `.env`
antes de atualizar uma instalação existente.

## Execução

A API e o Web são processos Node.js executados exclusivamente pelo PM2. O Docker Compose
não contém nem constrói esses dois serviços.

```bash
npm ci
npm ci --prefix apps/web
npm run build:api
npm run build --prefix apps/web
pm2 startOrReload ecosystem.config.cjs
```

O Docker fica restrito às dependências de infraestrutura:

```bash
docker compose config
docker compose up -d
```

A API escuta em `127.0.0.1:8000`, o Web em `127.0.0.1:3000` e a Evolution em
`127.0.0.1:8081`. Use um proxy reverso com TLS para a exposição pública e não publique
PostgreSQL, Redis ou o painel da Evolution diretamente na internet.

## Compatibilidade

Foram preservados os endpoints `/api/*`, o formato de sessão, o frontend e as tabelas.
O schema SQLite é criado de forma idempotente pela API NestJS. Consulte
`packages/contracts/README.md` e `infra/docker/README.md` antes de uma atualização.
