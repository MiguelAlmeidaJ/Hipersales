# HiperSales no SQL Server

O SQL Server é o banco principal da API HiperSales. O PostgreSQL permanece no
Compose exclusivamente para a Evolution API, com volume e credenciais próprios.

## Configuração

Defina no `.env` local:

```dotenv
HIPERSALES_DATABASE_ADMIN_PASSWORD=<SENHA_FORTE_APENAS_PARA_INICIALIZACAO>
SQLSERVER_DATABASE_URL=sqlserver://localhost:14333;database=hipersales;user=hipersales_app;password={SENHA};encrypt=true;trustServerCertificate=true
```

Use o login `sa` somente para criar banco/login e restaurar backups. A API deve
usar um login dedicado com privilégios mínimos. Em produção, mantenha
`encrypt=true` com certificado confiável; `trustServerCertificate=true` é apenas
para desenvolvimento local.

## Operação

```powershell
docker compose up -d
pnpm prisma:validate
pnpm prisma:migrate
pnpm build
pnpm test
```

As migrations ficam em `packages/database/prisma/migrations` e o
schema ativo em `packages/database/prisma/schema.prisma`. Não use
`prisma db push` no banco operacional e nunca execute `docker compose down -v`
sem um backup restaurável.

Antes de cada entrega, valide contagens e chaves estrangeiras com
`pnpm smoke:database`, teste backup/restauração e execute a homologação em um
banco dedicado terminado em `_test` ou `_validation`.
