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

Configure `SQLSERVER_DATABASE_URL` no `.env` da raiz com o login dedicado da aplicação. Em produção, a API recusa inicialização quando essa URL usa `sa`. A credencial administrativa fica separada em `.env.infrastructure` e é usada somente pelo Docker e pelo provisionamento; consulte [`docs/database.md`](../../docs/database.md).

Services acessam somente o `DatabaseRepository`, que centraliza consultas parametrizadas, transações e normalização sobre o Prisma Client.

Em um banco novo, configure `HYPERSALES_BOOTSTRAP_ADMIN_EMAIL` e `HYPERSALES_BOOTSTRAP_ADMIN_PASSWORD` (mínimo de 12 caracteres). O administrador inicial é criado uma única vez e deve trocar a senha no primeiro acesso.

## Testes de banco

A suíte de homologação integrada requer `TEST_DATABASE_URL` apontando exclusivamente para um banco cujo nome termine em `_test` ou `_validation`. A pipeline provisiona e migra `hipersales_test` antes dos testes.

## Módulos

- `auth`: sessões, cookies e credenciais.
- `catalog`, `customers`, `users`: cadastros e vínculos da organização única HiperMix.
- `proposals`, `occurrences`: operação comercial, anexos e notificações.
- `goals`, `dashboard`: indicadores e metas.
- `documents`: PDFs de pedidos, ocorrências, clientes e relatórios.
- `settings`: SMTP, Evolution API, webhook e processamento da outbox.
- `jobs`: relatórios semanais e lembretes de metas.

Rotas são autenticadas por padrão. Use `@Public()` somente em webhooks ou endpoints explicitamente públicos e `@Roles("admin")` nas operações administrativas. O perfil `dev` herda acesso administrativo, mas permanece invisível para `admin` e `seller`; consulte [`docs/access-control.md`](../../docs/access-control.md).

Os workers podem ser desligados separadamente com `HIPERSALES_OUTBOX_WORKER=false` e `HIPERSALES_SCHEDULED_JOBS=false`.

## Versionamento HTTP

O contrato público atual usa o prefixo `/api/v1` e devolve o cabeçalho `X-API-Version: v1`. As rotas históricas sob `/api/*` continuam ativas durante a transição de clientes instalados, mas novos consumidores devem usar somente `/api/v1/*`. Mudanças incompatíveis de payload ou autenticação devem ser publicadas em uma nova versão.
