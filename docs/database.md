# SQL Server: usuario dedicado e configuracao centralizada

Todas as credenciais ficam no `.env` da **raiz** do monorepo (ignorado pelo Git). O SQL Server atende o HiperSales; PostgreSQL e Redis continuam exclusivos da Evolution API.

## Primeira configuracao

1. Copie `.env.example` para `.env` e preencha `HIPERSALES_DATABASE_ADMIN_PASSWORD`, `SQLSERVER_DATABASE_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_DB_PASSWORD`.
2. Defina no `SQLSERVER_DATABASE_URL` um usuario proprio, como `hipersales_app`, e uma senha **diferente** da do `sa`.
3. Inicie a infraestrutura: `docker compose up -d`.
4. Crie banco, login e usuario: `pnpm database:setup-user`.
5. Verifique a conexao exibida ao final; em seguida execute a API.

O comando `database:setup-user` usa o `sa` apenas para provisionar, sem recriar bancos existentes. Concede ao usuario da aplicacao `db_datareader`, `db_datawriter` e `EXECUTE`. Nao concede `sysadmin`, `db_owner` ou permissoes DDL. O login ja existente tem sua senha preservada; se alterar a senha no `.env`, altere-a tambem no SQL Server com uma operacao administrativa.

## Migracoes

O usuario `hipersales_app` nao deve executar migracoes de estrutura. Execute `pnpm prisma:migrate` com uma **conexao administrativa temporaria**, autorizada somente durante o deploy (por exemplo, substituindo `SQLSERVER_DATABASE_URL` apenas no ambiente do processo de migracao, nunca no `.env` permanente). Depois, use novamente o login da aplicacao. Nao conceda `db_owner` ao usuario da API para contornar erros de migracao.

Valide com `pnpm prisma:validate`, `pnpm build`, `pnpm test` e `pnpm smoke:database`. Faca backup antes de migracoes; nao use `prisma db push` nem `docker compose down -v` em banco operacional.

Em producao, use TLS validado com `encrypt=true` e `trustServerCertificate=false`; `trustServerCertificate=true` somente no ambiente local.
