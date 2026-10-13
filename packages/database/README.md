# Migracao SQLite → PostgreSQL com Prisma

**Estado:** preparacao, sem cutover. O backend atual e NestJS/TypeScript, baseado em `node:sqlite` e SQL SQLite direto. Prisma Client e Node.js/TypeScript; instalar Prisma e mudar uma URL nao migra essas consultas. O backend NestJS permanece em SQLite ate que os servicos sejam adaptados para Prisma/PostgreSQL e testados.

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
4. Implementar repositorios Prisma em um servico Node com contratos internos versionados, no NestJS existente. **Nao** fingir que Prisma Client roda diretamente no Python.
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

**Avisos:** use essa importação somente em ambiente isolado/homologação. `DATABASE_URL` nos argumentos do `psql` pode ficar visível na lista de processos; execute em servidor seguro. Não suba a API em PostgreSQL após importar: a API NestJS ainda usa SQLite. Falta implementação do adaptador PostgreSQL, reconciliação de constraints/índices e validação dos fluxos da aplicação. A ferramenta recusa um schema público com tabelas existentes e não altera o SQLite original.

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

A API recebeu `PostgreSQLConnection` em `(legado removido) apps/api/postgres_adapter.py`, com `execute`, `executemany`, `commit`, `rollback` e gestão de transação via `with`. **Ainda não substitui `foundation.connect()`**; comandos DDL, funções SQL e fluxos com `RETURNING id` dependem de implementação posterior. Ele rejeita operações com padrões incompatíveis conhecidos, mas não é um tradutor SQL completo.

Teste apenas a conectividade, sem alterar tabelas:

```bash
python3 -m pip install 'psycopg[binary]'
python3 -m unittest discover -s apps/api/tests -p test_postgres_adapter.py
DATABASE_URL='postgresql://...' python3 apps/api/scripts/test_pg_connection.py
```

**Não altere o PM2 para PostgreSQL ainda**, pois o servidor principal continua SQLite.

## Primeiro passo local liberado: snapshot verificável no Windows

Com PostgreSQL conectado, você já pode preparar um **snapshot de ensaio**, sem migrar ainda a API nem apagar o SQLite. No Git Bash, na raiz:

```bash
git pull origin main
python -m unittest discover -s apps/api/tests -p test_sqlite_snapshot.py
python packages/database/scripts/prepare_sqlite_snapshot.py --output backups/hipersales-ensaio-01.sqlite3
```

O utilitário lê `HYPERSALES_DB_PATH` do `.env` (padrão: `database/hypersales.sqlite3`), usa a API nativa de backup do SQLite e grava arquivo `.manifest.json` com SHA-256, contagem por tabela e verificações de integridade/FKs. O arquivo de saída **não pode existir previamente**, para impedir sobrescrita acidental. Se detectar falha de integridade/FK, recusa o snapshot.

Não execute importação definitiva ainda. O procedimento antigo de importação com `pgloader` depende de ferramentas externas e não faz o cutover da API NestJS. A conclusão requer adaptar os comandos específicos do SQLite na API e homologar PostgreSQL antes de alternar o PM2.

## Situacao revisada em outubro/2026

A migracao de codigo Python -> NestJS terminou, e o CI para o commit `0810d20` passou no build, nos testes e no typecheck. **Isso nao e uma migracao de banco de dados**: `apps/api/src/database/database.service.ts` ainda instancia `DatabaseSync`, enquanto os servicos usam SQL SQLite direto. O esquema Prisma existente e preparatorio. Scripts Python em `packages/database/scripts/` sao ferramentas auxiliares de migracao, nao o backend do produto. Trechos acima que descrevem etapas antigas devem ser interpretados como registro historico, e nao como comandos prontos para cutover.

Proxima fase: (1) inventariar tabelas, consultas e constraints do SQLite; (2) definir migrations versionadas PostgreSQL/Prisma; (3) criar camada de acesso aos dados no NestJS e substituir consultas em lotes; (4) testar copias de dados e reconciliar IDs/contagens; (5) cortar a escrita SQLite apenas depois de homologacao integral. Manter backup verificado e caminho de rollback.
