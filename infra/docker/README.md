# Operação Docker

O Docker Compose provisiona somente infraestrutura: PostgreSQL, Redis e Evolution API.
A API NestJS e o frontend Next.js não possuem Dockerfile e são executados pelo PM2.

1. Copie `.env.example` para `.env` e configure chaves e senhas.
2. Configure `HYPERSALES_PUBLIC_URL` com a URL HTTPS pública da API.
3. Valide com `docker compose config`.
4. Inicie a infraestrutura com `docker compose up -d`.
5. Verifique com `docker compose ps` e `docker compose logs -f evolution postgres redis`.

A Evolution fica vinculada a `127.0.0.1:8081`. Os bancos e o Redis não publicam portas
no Compose principal. O serviço `hipersales-postgres` está provisionado para a futura
migração do banco comercial; a API ainda usa SQLite.

Não execute `docker compose down -v` quando houver dados que precisem ser preservados.
Os volumes da Evolution guardam banco, cache e sessões do WhatsApp.
