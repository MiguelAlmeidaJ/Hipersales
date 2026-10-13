# API HiperSales

Backend NestJS/TypeScript com SQL Server e Prisma 7. O schema, as migrations e o Prisma Client pertencem ao pacote compartilhado `packages/database`.

## Desenvolvimento

Na raiz do repositório:

```bash
pnpm install
pnpm prisma:validate
pnpm prisma:migrate
pnpm build:database
pnpm build:api
pnpm test:api
pnpm dev:api
```

Configure `SQLSERVER_DATABASE_URL` para o banco. Services acessam somente o `DatabaseRepository`, que centraliza consultas parametrizadas, transações e normalização sobre o Prisma Client.

Em um banco novo, configure `HYPERSALES_BOOTSTRAP_ADMIN_EMAIL` e `HYPERSALES_BOOTSTRAP_ADMIN_PASSWORD` (mínimo de 12 caracteres). O administrador inicial é criado uma única vez e deve trocar a senha no primeiro acesso.

## Testes de banco

A suíte de homologação integrada requer `TEST_DATABASE_URL` apontando exclusivamente para um banco cujo nome termine em `_test` ou `_validation`. A pipeline provisiona e migra `hipersales_test` antes dos testes.

## Módulos

- `auth`: sessões, cookies e credenciais.
- `catalog`, `customers`, `users`: cadastros e vínculos com isolamento por tenant.
- `proposals`, `occurrences`: operação comercial, anexos e notificações.
- `goals`, `dashboard`: indicadores e metas.
- `documents`: PDFs de pedidos, ocorrências, clientes e relatórios.
- `settings`: SMTP, Evolution API, webhook e processamento da outbox.
- `jobs`: relatórios semanais e lembretes de metas.

Rotas são autenticadas por padrão. Use `@Public()` somente em webhooks ou endpoints explicitamente públicos e `@Roles("admin")` nas operações administrativas.

Os workers podem ser desligados separadamente com `HIPERSALES_OUTBOX_WORKER=false` e `HIPERSALES_SCHEDULED_JOBS=false`.
