# Banco de dados HiperSales

Pacote compartilhado responsável pelo schema Prisma, migrations versionadas e
Prisma Client da API. O runtime acessa o banco pelo `DatabaseRepository` da API.

## Estrutura

- `prisma/schema.prisma`: fonte única do modelo de dados.
- `prisma/migrations`: histórico versionado de migrations.
- `src/generated/prisma`: client gerado, não versionado.
- `scripts/smoke_database.mjs`: valida contagens e integridade do banco.
- `scripts/create_test_database.mjs`: prepara o banco descartável da CI.
- `scripts/import_legacy_data.py`: ferramenta preservada para auditar/repetir a importação legada.

## Comandos

```powershell
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate
pnpm smoke:database
```

Não use `prisma db push` no banco operacional. Novas alterações de schema devem
ser entregues como migrations e homologadas em um banco terminado em `_test` ou
`_validation` antes da aplicação em produção.
