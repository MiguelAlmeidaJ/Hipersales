# Operação Docker

O Compose provisiona SQL Server para o HiperSales, PostgreSQL e Redis exclusivos
da Evolution API, além da própria Evolution. API NestJS e frontend Next.js são
executados pelo PM2.

1. Copie `.env.example` para `.env` e configure o runtime, incluindo `HYPERSALES_PUBLIC_URL` e `SQLSERVER_DATABASE_URL` com o usuário da aplicação.
2. Copie `.env.infrastructure.example` para `.env.infrastructure` e configure os segredos administrativos.
3. Valide com `docker compose --env-file .env --env-file .env.infrastructure config`.
4. Inicie com `pnpm infra:up`.
5. Verifique com `pnpm infra:ps` e os logs dos serviços.

O `.env.infrastructure` não é carregado pela API. A senha do `sa` é usada somente pelo contêiner SQL Server e pelo comando explícito `pnpm database:setup-user`.

Não execute `docker compose down -v` quando houver dados a preservar. Os volumes
guardam o banco HiperSales, o banco/cache da Evolution e sessões do WhatsApp.
