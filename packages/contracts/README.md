# Contratos e limites de mudanca

Este diretorio agora e o pacote `@hipersales/contracts`. Ele concentra schemas
Zod e tipos TypeScript independentes de framework para que API, web e testes
validem os mesmos payloads durante a migracao para NestJS.

| Fronteira | Contrato preservado |
| --- | --- |
| Web → API | mesmas rotas `/api/*`, JSON, cookies e codigos HTTP |
| API → SQLite | mesmos nomes de tabelas, colunas e migracoes existentes |
| API → Evolution | `apikey`, `/instance/*`, `/message/sendText/{instance}`, `/webhook/set/{instance}` |
| Evolution → API | `POST /api/evolution/webhook?token=...` |
| Hospedagem | `HOST`, `PORT`, `HYPERSALES_DB_PATH`, `HYPERSALES_PUBLIC_URL` |

Nao alterar os contratos sem testes de caracterizacao, migracao versionada e revisao explicita. Os nomes das instancias WhatsApp seguem `hipersales-tenant-{id}` para preservar o isolamento atual por tenant.

A migracao e incremental: as rotas de sessao ja usam os contratos executaveis em
`src/auth.ts`; os demais payloads devem ser adicionados aqui somente depois de
testes de caracterizacao do comportamento Python.
