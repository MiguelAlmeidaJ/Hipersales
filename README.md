# Hipersales — monorepo

Aplicacao com backend NestJS/TypeScript, frontend Next.js e integracao Evolution API.

## Estrutura

- `apps/api/src/`: API publica NestJS/TypeScript, documentos e jobs.
- `apps/web/`: frontend Next.js.
- `packages/contracts/`: schemas Zod e tipos TypeScript compartilhados.
- `infra/docker/`: PostgreSQL/Redis/Evolution API v2 e a API Hipersales.
- `scripts/`: utilitarios de importacao e relatorios (validar caminhos antes da execucao).

## Desenvolvimento local

Consulte `apps/api/README.md` para iniciar o NestJS.
Abra http://localhost:3000. O banco local padrao fica em
`database/hypersales.sqlite3` (ignorado pelo Git). Antes de atualizar uma
instalacao existente, preserve o arquivo SQLite e a configuracao `.env`.

## Docker

```bash
cp .env.example .env
# preencha as chaves e a senha
docker compose up -d --build
```

A aplicacao escuta na porta 8000 e o Evolution na porta 8081 vinculada ao localhost. Em producao, defina HYPERSALES_PUBLIC_URL com URL HTTPS publica do Hipersales; a Evolution usa esse endereco para callback de webhook. Configure TLS e proxy reverso para o backend; nao publique PostgreSQL, Redis ou painel Evolution na internet sem controles.

**Importante:** a Evolution API e um servico distinto e usa internamente um mecanismo WhatsApp denominado WHATSAPP-BAILEYS. A dependencia Baileys **foi removida do codigo do Hipersales**, nao do funcionamento interno do produto de terceiros.

## Compatibilidade

Preservados: endpoints `/api/*`, formato de sessao, frontend e tabelas. O schema
SQLite e criado de forma idempotente pela API Nest; preserve backups antes de atualizacoes.

Consulte `packages/contracts/README.md` e `infra/docker/README.md`. Execute testes de regressao e validacao em ambiente de homologacao antes de substituir a implantacao atual.
