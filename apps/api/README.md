# API HiperSales

O ponto de entrada publico e agora NestJS/TypeScript. A primeira fatia migrada
inclui login, logout, sessao, troca de senha e health check. Os demais dominios
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

1. Catalogo (empresas e produtos).
2. Clientes, usuarios e vinculos.
3. Propostas e ocorrencias.
4. Dashboard, metas e relatorios.
5. Integracoes, webhooks e jobs; entao remover `LegacyProxyMiddleware` e Python.
