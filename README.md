# Hipersales — monorepo

Aplicacao existente reorganizada sem mudar regras de negocio, rotas, payloads ou esquema SQLite.

## Estrutura

- `apps/api/`: backend Python HTTP nativo, SQLite e integracao Evolution API existente.
- `apps/web/`: frontend HTML, JS e PWA sem novo framework.
- `packages/contracts/`: contratos de integracao e regras de compatibilidade.
- `infra/docker/`: PostgreSQL/Redis/Evolution API v2 e a API Hipersales.
- `scripts/`: utilitarios de importacao e relatorios (validar caminhos antes da execucao).

## Desenvolvimento local

```bash
python apps/api/app.py
```

Abra http://localhost:8000. O banco local padrao fica em `database/hypersales.sqlite3` (ignorado pelo Git). Antes de atualizar uma instalacao existente, preserve o arquivo SQLite e a configuracao .env.

## Docker

```bash
cp .env.example .env
# preencha as chaves e a senha
docker compose up -d --build
```

A aplicacao escuta na porta 8000 e o Evolution na porta 8081 vinculada ao localhost. Em producao, defina HYPERSALES_PUBLIC_URL com URL HTTPS publica do Hipersales; a Evolution usa esse endereco para callback de webhook. Configure TLS e proxy reverso para o backend; nao publique PostgreSQL, Redis ou painel Evolution na internet sem controles.

**Importante:** a Evolution API e um servico distinto e usa internamente um mecanismo WhatsApp denominado WHATSAPP-BAILEYS. A dependencia Baileys **foi removida do codigo do Hipersales**, nao do funcionamento interno do produto de terceiros.

## Compatibilidade

Preservados: endpoints /api/*, formato de sessao, frontend, tabelas e jobs Python. O unico ajuste funcional de infraestrutura e o caminho de frontend agora em `apps/web`. A integracao Evolution ja existia no backend antes desta reorganizacao. Nao ha migracao de dados automatica.

Consulte `packages/contracts/README.md` e `infra/docker/README.md`. Execute testes de regressao e validacao em ambiente de homologacao antes de substituir a implantacao atual.
