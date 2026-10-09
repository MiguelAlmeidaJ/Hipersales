# API HiperSales

O ponto de entrada publico e agora NestJS/TypeScript. As fatias migradas incluem autenticacao, health check e consultas de empresas e produtos (administrador e representante). Os demais dominios
continuam no processo Python interno e sao encaminhados pelo Nest sem alterar as
rotas `/api/*`; esse proxy e uma ponte temporaria, nao uma arquitetura final.

## Desenvolvimento

Na raiz do repositorio:

```bash
npm install
npm run build:api
```

Inicie o legado na porta interna e depois o Nest:

```powershell
$env:PORT=8001; python apps/api/app.py
$env:LEGACY_API_ORIGIN="http://127.0.0.1:8001"; npm run dev --workspace @hipersales/api
```

O frontend continua chamando somente a porta publica `8000`.

## Estrutura nova

- `src/auth`: sessao e credenciais, preservando o hash PBKDF2 e o cookie legado.
- `src/common/guards`: autenticacao fechada por padrao e autorizacao por papel.
- `src/common/middleware`: verificacao de origem para requisicoes mutaveis.
- `src/database`: acesso SQLite encapsulado para a fase de compatibilidade.
- `src/legacy`: proxy isolado que desaparecera conforme cada dominio for portado.
- `packages/contracts`: schemas Zod e tipos compartilhados com o frontend.

Novos controllers devem declarar `@Public()` apenas quando realmente publicos;
o `SessionGuard` global exige sessao em todos os outros. Rotas administrativas
devem declarar `@Roles("admin")`.

## Ordem recomendada da migracao

1. Homologar as escritas de catalogo no Nest e migrar importacao/exportacao. Revisar exclusao de empresa, pois o legado apaga pedidos em cascata.
2. Clientes, usuarios e vinculos.
3. Propostas e ocorrencias.
4. Dashboard, metas e relatorios.
5. Integracoes, webhooks e jobs; entao remover `LegacyProxyMiddleware` e Python.

## Fase de transicao do catalogo

Consultas e escritas basicas de empresas e produtos agora sao atendidas pelo Nest. Migradas: GET /api/companies, GET /api/products, GET /api/admin/companies, GET /api/admin/products; POST/PATCH de empresas; POST/PATCH/DELETE de produtos. As regras de associacao de representante, tenant_id, unicidade de codigo e bloqueio de exclusao de produto com historico foram preservadas. Exclusao de empresa (destrutiva, remove pedidos), importacao de produtos e exportacao CSV continuam no Python.

Validacao antes de reiniciar a API:

```bash
npm ci
npm run build:api
npm run test:api
```

Somente depois de os comandos passarem, garanta que `hipersales-api-legacy` esta online na porta 8001 e reinicie `hipersales-api` via PM2. Nao desligue o Python nem troque o banco nesta fase.

## Etapa de transferencia de produtos

Os endpoints `GET /api/admin/products/export` e `POST /api/admin/products/import` passaram para NestJS. O CSV mantém as mesmas colunas do legado, e a importação usa uma transação única com rollback em caso de dados inválidos. O limite por lote é de 10.000 registros. A exclusão de empresas permanece no Python; o comportamento destrutivo do legado não deve ser reproduzido sem revisão das relações com pedidos.

Validar antes de implantar: `npm run build:api` e `npm run test:api`. Manter os processos Nest e Python durante a transição.
