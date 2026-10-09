# Ensaio local: snapshot SQLite -> PostgreSQL (Windows / Git Bash)

API e Next.js podem rodar no PM2, mas **a API continua em SQLite**. Importar uma cópia no PostgreSQL não ativa o novo backend. Não aponte a API ao PostgreSQL ainda.

Pré-requisitos: PostgreSQL local saudável em Docker, `DATABASE_URL` no `.env` sem `?schema=public`, pacote `psycopg[binary]` e snapshot validado.

```bash
git pull origin main
docker compose -f compose.database.yml ps
python -m unittest discover -s apps/api/tests -p test_sqlite_snapshot.py
python packages/database/scripts/import_snapshot_pg.py --snapshot backups/hipersales-ensaio-01.sqlite3
```

O último comando é um dry-run, sem gravação. Antes da importação, confirme que o banco comercial `hipersales` é **exclusivamente de homologação e está vazio**, sem dados importantes. O importador recusa schema público com tabelas existentes e executa tudo numa transação. Confira a URL do banco na configuração local antes de prosseguir.

```bash
python packages/database/scripts/import_snapshot_pg.py --snapshot backups/hipersales-ensaio-01.sqlite3 --execute
python packages/database/scripts/compare_databases.py --sqlite backups/hipersales-ensaio-01.sqlite3
python packages/database/scripts/check_pg_readiness.py --sqlite backups/hipersales-ensaio-01.sqlite3
```

Os utilitários de comparação anteriores consultam `DATABASE_URL` do ambiente (não carregam o `.env` automaticamente). No Git Bash, configure a variável antes de executá-los, sem publicar a senha:

```bash
export DATABASE_URL="$(python -c 'import os,sys;sys.path.insert(0,"apps/api");from pathlib import Path;from env_loader import load_env_file;load_env_file(Path(".env"));print(os.environ["DATABASE_URL"])')"
```

**Atenção:** o comparador valida tabelas, colunas e contagens, não garante igualdade de valores nem compatibilidade de operações da API. A importação pode falhar para schemas SQLite contendo índices parciais/expressões ou recursos não cobertos; um erro reverte a transação. Não execute novamente `--execute` sobre um banco já preenchido.

## Subir o código para validação da interface (backend ainda SQLite)

```bash
cd apps/web && npm install && npm run build && cd ../..
pm2 start ecosystem.config.cjs --only hipersales-api
pm2 start ecosystem.config.cjs --only hipersales-web
pm2 status
```

Se não houver instalação da Evolution API em `services/evolution-api`, **não** execute `pm2 start ecosystem.config.cjs` sem `--only`; o terceiro processo depende de instalação independente. Para testes de aplicação, abra http://127.0.0.1:3000 e acompanhe os logs de API/Web.

**Não desligar o SQLite após importar.** A mudança de driver do backend, os testes de queries reais, as validações de integridade e o plano de rollback ainda são bloqueios para o cutover.
