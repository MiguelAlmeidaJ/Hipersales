# PostgreSQL isolado via Docker, API e Web via PM2 (Windows PowerShell)

O banco comercial deve subir primeiro. O arquivo `compose.database.yml` inicia **somente PostgreSQL**, ligado a `127.0.0.1:5432`; não inicia o backend, Next.js nem Evolution.

## Instalação e teste

Na raiz do repositório:

```powershell
git pull origin main
# Configure HIPERSALES_DB_PASSWORD no .env, com uma senha forte, antes de subir
docker compose -f compose.database.yml up -d
docker compose -f compose.database.yml ps
docker compose -f compose.database.yml logs --tail 30 hipersales-postgres
python -m pip install "psycopg[binary]"
python -m unittest discover -s apps/api/tests -p test_postgres_adapter.py
```

No `.env` da raiz configure as credenciais correspondentes:

```dotenv
HIPERSALES_DB_PASSWORD=SUA_SENHA
DATABASE_URL=postgresql://hipersales:SUA_SENHA@127.0.0.1:5432/hipersales
```

Se a senha tiver símbolos especiais, faça URL-encode na `DATABASE_URL`. Depois execute:

```powershell
python apps/api/scripts/test_pg_connection.py
```

**Importante**: o serviço PostgreSQL já existente no `docker-compose.yml` usa outro volume. Não inicie ambos sobre a mesma porta e não mude de projeto Compose sem avaliar os volumes. Nunca execute `docker compose down -v` durante testes com dados importantes: essa opção apaga o volume do banco.

## Sem migração definitiva por enquanto

A conexão prova somente que o PostgreSQL está disponível. O backend Python ainda usa SQLite. Não copie dados reais nem configure o PM2 para usar PostgreSQL até os comandos SQLite restantes e a validação completa estarem concluídos.
