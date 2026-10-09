# API HiperSales

Backend NestJS/TypeScript. O legado Python foi removido.

## Desenvolvimento

Na raiz do repositorio:

```bash
npm ci
npm run build:api
npm run test:api
npm run dev --workspace @hipersales/api
```

A API usa SQLite em `database/hypersales.sqlite3` por padrao e cria o schema de forma
idempotente. Configure `HYPERSALES_DB_PATH` para outro caminho.

## Modulos

- `auth`: sessoes, cookies e credenciais.
- `catalog`, `customers`, `users`: cadastros e vinculos com isolamento por tenant.
- `proposals`, `occurrences`: operacao comercial e notificacoes.
- `goals`, `dashboard`: indicadores e metas.
- `documents`: PDFs de pedidos, ocorrencias, clientes e relatorios.
- `settings`: SMTP, Evolution API, webhook e processamento da outbox.
- `jobs`: relatorios semanais e lembretes de metas.

Rotas sao autenticadas por padrao. Use `@Public()` somente em webhooks ou endpoints
explicitamente publicos e `@Roles("admin")` em operacoes administrativas.

Os workers podem ser desligados separadamente com `HIPERSALES_OUTBOX_WORKER=false` e
`HIPERSALES_SCHEDULED_JOBS=false`.
