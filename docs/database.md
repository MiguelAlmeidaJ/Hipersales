# SQL Server: credenciais e usuário da aplicação

O SQL Server atende o HiperSales. PostgreSQL e Redis são exclusivos da Evolution API. Credenciais administrativas nunca devem ser disponibilizadas ao processo da API.

## Arquivos de ambiente

| Arquivo local | Base versionada | Consumidor | Pode conter segredo administrativo |
|---|---|---|---|
| `.env` | `.env.example` | API, Web, Prisma e integrações | Não |
| `.env.infrastructure` | `.env.infrastructure.example` | Docker e provisionamento explícito | Sim |
| `apps/mobile/.env.local` | `apps/mobile/.env.example` | Expo/React Native | Nunca; `EXPO_PUBLIC_*` é público |

Os arquivos locais são ignorados pelo Git e também excluídos do contexto Docker. Em produção, restrinja a leitura de `.env.infrastructure` ao usuário de deploy.

## Provisionar o login da aplicação

1. Copie `.env.example` para `.env` e configure `SQLSERVER_DATABASE_URL` com um login dedicado, por exemplo `hipersales_app`, e senha exclusiva.
2. Copie `.env.infrastructure.example` para `.env.infrastructure` e configure `HIPERSALES_DATABASE_ADMIN_PASSWORD`.
3. Confirme que o banco informado na URL já existe e possui as migrations.
4. Execute `pnpm database:setup-user` na raiz.

O comando usa a conta administrativa apenas durante o provisionamento. Ele é idempotente e:

- cria o login e o usuário de banco quando ainda não existem;
- adiciona somente `db_datareader` e `db_datawriter`;
- não concede `sysadmin`, `db_owner`, DDL ou `EXECUTE` global;
- preserva a senha de um login já existente;
- testa uma conexão real com o login da aplicação e confirma que ele não é `db_owner`.

Se a senha da aplicação mudar no `.env`, altere primeiro a senha do login por um procedimento administrativo controlado. O provisionador não redefine automaticamente credenciais existentes.

## Migrations

O login `hipersales_app` é de runtime e não executa migrations. Durante o deploy, forneça ao comando `pnpm prisma:migrate` uma conexão administrativa temporária pelo ambiente do processo. Não grave essa URL em `.env` e restaure o ambiente normal imediatamente depois.

Fluxo de produção recomendado:

1. validar backup restaurável;
2. aplicar migrations com credencial administrativa efêmera;
3. executar `pnpm database:setup-user` se for a primeira instalação;
4. iniciar/recarregar a API, que usa apenas `SQLSERVER_DATABASE_URL` do login da aplicação;
5. executar `pnpm smoke:database` e validar login e operações essenciais.

Não conceda `db_owner` à aplicação para contornar falhas de migration. Não execute `prisma db push` nem `docker compose down -v` em banco operacional.

## Produção

- Use `encrypt=true` e `trustServerCertificate=false` com certificado confiável.
- Use senhas diferentes para `sa`, `hipersales_app`, PostgreSQL e usuários humanos.
- Injete os segredos pelo ambiente/secret manager da infraestrutura quando disponível.
- A API recusa inicialização em produção se `SQLSERVER_DATABASE_URL` usar `sa`.
- Nunca coloque credenciais em `EXPO_PUBLIC_*`: esses valores são incorporados ao binário mobile.
