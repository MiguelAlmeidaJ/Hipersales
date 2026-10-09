# Atualizar maquina local (Windows / PowerShell)

**Antes:** backup dos dados reais. A branch `old` protege o historico do codigo mas **nao** protege um banco SQLite que esta na maquina local.

## Atualizacao segura do codigo

No PowerShell, na pasta do projeto:

```powershell
git status
git fetch origin
git switch main
git pull --ff-only origin main
```

Ou execute `powershell -ExecutionPolicy Bypass -File scripts/update-local.ps1`, que recusa atualizar uma pasta com alteracoes nao salvas.

Se for a primeira instalacao:

```powershell
git clone https://github.com/MiguelAlmeidaJ/Hipersales.git
cd Hipersales
```

Para iniciar a versao atual da API:

```powershell
npm ci
npm run dev --workspace @hipersales/api
```

O backend Python foi removido; use somente a API NestJS.

## Banco de dados

O SQLite permanece ativo ate a conclusao da migracao. Salve uma copia consistente de `database/hypersales.sqlite3` **com a aplicacao parada** ou usando a API de backup SQLite; copiar o arquivo enquanto WAL esta ativo pode perder transacoes.

Nao execute `prisma db push`, `prisma migrate deploy` ou `docker compose down -v` sobre dados de producao nesta etapa.

O Docker exige Docker Desktop/Engine e arquivo `.env` com credenciais. O Postgres de Hipersales existe como servico isolado, ainda sem receber o banco legado.

## Checklist antes de operar em PostgreSQL

1. Completar relacoes e constraints Prisma e validar o schema.
2. Gerar migracao versionada e executar em ambiente descartavel.
3. Desenvolver repositorios Prisma e adaptar o backend.
4. Migrar copia do SQLite e verificar contagens, IDs, hashes e referencias.
5. Comparar respostas/endpoints e relatorios.
6. Congelar escrita, executar migracao final, validar e habilitar novo backend.
