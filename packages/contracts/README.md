# Contratos e limites de mudanca

Este diretorio documenta o contrato atual, **nao adiciona nova camada em runtime**.

| Fronteira | Contrato preservado |
| --- | --- |
| Web → API | mesmas rotas `/api/*`, JSON, cookies e codigos HTTP |
| API → SQLite | mesmos nomes de tabelas, colunas e migracoes existentes |
| API → Evolution | `apikey`, `/instance/*`, `/message/sendText/{instance}`, `/webhook/set/{instance}` |
| Evolution → API | `POST /api/evolution/webhook?token=...` |
| Hospedagem | `HOST`, `PORT`, `HYPERSALES_DB_PATH`, `HYPERSALES_PUBLIC_URL` |

Nao alterar os contratos sem testes de caracterizacao, migracao versionada e revisao explicita. Os nomes das instancias WhatsApp seguem `hipersales-tenant-{id}` para preservar o isolamento atual por tenant.

A API e o frontend continuam implementados na tecnologia original. Tipos OpenAPI/TypeScript podem ser introduzidos a partir de capturas de respostas verificadas, sem supor novos formatos.
