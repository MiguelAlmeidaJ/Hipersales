# Operação Docker

O Compose provisiona SQL Server para o HiperSales, PostgreSQL e Redis exclusivos
da Evolution API, além da própria Evolution. API NestJS e frontend Next.js são
executados pelo PM2.

1. Copie `.env.example` para `.env` e configure chaves e senhas.
2. Configure `HYPERSALES_PUBLIC_URL` e `SQLSERVER_DATABASE_URL`.
3. Valide com `docker compose config`.
4. Inicie com `docker compose up -d`.
5. Verifique com `docker compose ps` e os logs dos serviços.

Não execute `docker compose down -v` quando houver dados a preservar. Os volumes
guardam o banco HiperSales, o banco/cache da Evolution e sessões do WhatsApp.
