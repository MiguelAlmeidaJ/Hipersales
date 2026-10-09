# Migracao SQLite → PostgreSQL com Prisma

**Estado:** preparacao, sem cutover. O backend atual e Python, baseado em `sqlite3` e SQL SQLite direto. Prisma Client e Node.js/TypeScript; instalar Prisma e mudar uma URL nao migra essas consultas. O backend existente continua usando SQLite ate que os repositorios de dados sejam adaptados e testados.

## Limites inegociaveis

- Preservar IDs, tenants, senhas hash, permissoes, dados de pedidos, estados e timestamps.
- Nao executar `prisma db push` contra dados reais. Criar migracoes versionadas e testar contra copia.
- Conservar rotas JSON, sessao via cookie, jobs e contratos existentes.
- Converter o esquema completo, incluindo tabelas acrescidas por `migrate_db()`, indices e FKs, antes do cutover.
- Nao executar um backend SQLite e um backend PostgreSQL escrevendo em paralelo sem reconciliacao.

## Etapas

1. Congelar copia consistente do SQLite de producao e verificar `PRAGMA integrity_check`.
2. Levantar esquema real e todas as consultas SQLite, inclusive `PRAGMA`, `INSERT OR IGNORE`, `?`, `lastrowid` e adaptacoes de `ON CONFLICT`.
3. Completar `schema.prisma` para **todas** as tabelas; reconciliar constraints do banco existente.
4. Implementar repositorios Prisma em um servico Node com contratos internos versionados, ou migrar o backend para Node/TypeScript. **Nao** fingir que Prisma Client roda diretamente no Python.
5. Testar cada fluxo em homologacao; migrar dados na ordem das FKs, preservar IDs, alinhar sequences e comparar contagens/checksums.
6. Fazer cutover atomico, apontando API para repositorios PostgreSQL e mantendo SQLite somente como backup.

## Arquivos

- `schema.prisma` contem mapeamentos iniciais de tabelas-base, **nao** o modelo completo.
- PostgreSQL `hipersales-postgres` ja pode ser iniciado em Docker sem substituir a base atual.
- Senhas de banco em `.env`, nunca no Git.

## Ferramenta de transferência inicial (sem cutover)

Foi adicionado `packages/database/scripts/sqlite_to_postgres.py`, que faz um backup online consistente do SQLite, verifica integridade, exige PostgreSQL com schema `public` vazio e importa usando `pgloader`. Compara a quantidade de linhas por tabela antes de considerar a transferência concluída.

Pré-requisitos: `python3`, `postgresql-client` (`psql`), `pgloader` e `DATABASE_URL` configurada para um banco PostgreSQL dedicado **vazio**. Faça a primeira execução com o backend parado/congelado para não acumular alterações após o snapshot.

```bash
# Na raiz do projeto, depois de configurar DATABASE_URL
python3 packages/database/scripts/sqlite_to_postgres.py --backup-dir ./migration-check-001
# Execução real (usa outro diretório para preservar o backup anterior)
python3 packages/database/scripts/sqlite_to_postgres.py --backup-dir ./migration-import-001 --execute
```

**Avisos:** use essa importação somente em ambiente isolado/homologação. `DATABASE_URL` nos argumentos do `psql` pode ficar visível na lista de processos; execute em servidor seguro. Não suba a API em PostgreSQL após importar: o backend Python ainda é SQLite. Falta implementação do adaptador PostgreSQL, reconciliação de constraints/índices e validação dos fluxos da aplicação. A ferramenta recusa um schema público com tabelas existentes e não altera o SQLite original.

## Verificação adicional, somente leitura

Após importar uma cópia em PostgreSQL, compare **tabelas, colunas e contagens** sem gravar nos bancos:

```bash
python3 -m pip install 'psycopg[binary]'
DATABASE_URL='postgresql://...' python3 packages/database/scripts/compare_databases.py --sqlite migration-import-001/hipersales-migration-snapshot.sqlite3
python3 -m unittest discover -s apps/api/tests -p test_postgres_adapter.py
python3 apps/api/scripts/audit_sqlite_dialect.py
```

O último comando **deve permanecer bloqueante** enquanto as operações SQLite não forem totalmente adaptadas. A comparação não valida conteúdo linha a linha nem libera mudança para PostgreSQL em produção.

## Auditoria de preparação PostgreSQL (sem alterar dados)

Após importar o snapshot para um banco de teste, execute:

```bash
DATABASE_URL='postgresql://...' python3 packages/database/scripts/check_pg_readiness.py --sqlite migration-import-001/hipersales-migration-snapshot.sqlite3
```

A auditoria consulta a integridade SQLite, tabelas, colunas, quantidades e sequências ligadas aos IDs. Ela apenas lê dados; não corrige ou altera sequences, nem instala o adaptador PostgreSQL na API. Mesmo quando passa, ainda é obrigatório converter os comandos específicos de SQLite e homologar os fluxos completos antes de liberar a migração.

## Adaptador transacional PostgreSQL (somente opt-in)

A API recebeu `PostgreSQLConnection` em `apps/api/postgres_adapter.py`, com `execute`, `executemany`, `commit`, `rollback` e gestão de transação via `with`. **Ainda não substitui `foundation.connect()`**; comandos DDL, funções SQL e fluxos com `RETURNING id` dependem de implementação posterior. Ele rejeita operações com padrões incompatíveis conhecidos, mas não é um tradutor SQL completo.

Teste apenas a conectividade, sem alterar tabelas:

```bash
python3 -m pip install 'psycopg[binary]'
python3 -m unittest discover -s apps/api/tests -p test_postgres_adapter.py
DATABASE_URL='postgresql://...' python3 apps/api/scripts/test_pg_connection.py
```

**Não altere o PM2 para PostgreSQL ainda**, pois o servidor principal continua SQLite.
