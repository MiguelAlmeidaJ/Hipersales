# Hipersales: plano de migracao PostgreSQL -> SQL Server

## Estado atual

Este branch sobe **somente um SQL Server de homologacao** no Docker. A aplicacao **continua usando PostgreSQL** ate que o codigo e os dados sejam validados. Nunca altere apenas DATABASE_URL esperando uma migracao automatica.

Os principais bloqueios encontrados na main sao:

- `packages/database/prisma/schema.prisma` usa `provider = "postgresql"`, `@db.Timestamptz(6)` e cascatas de exclusao que podem criar multiplos caminhos no SQL Server.
- `apps/api/src/database/prisma.service.ts` usa `@prisma/adapter-pg`.
- `apps/api/src/database/database.service.ts` traduz SQL legada para PostgreSQL: `ILIKE`, `string_agg`, `ON CONFLICT`, `RETURNING`, `$1`, `INTERVAL`, valores booleanos e SQL cru. SQL Server requer consultas parametrizadas, `OUTPUT INSERTED.id`, `OFFSET/FETCH`, `DATEADD`, `bit` e compatibilizacao de upserts.
- A Evolution API no `docker-compose.yml` usa PostgreSQL **separado**. Preservar seu container, volume e credenciais.
- Algumas chaves compostas `String` e indexes precisam de comprimentos `nvarchar` explicitamente limitados antes de criar constraints no SQL Server.

## 1. Subir SQL Server sem modificar dados existentes

Configure no arquivo local `.env` (nao versionar):

```dotenv
HIPERSALES_SQLSERVER_SA_PASSWORD=<SENHA_FORTE_COM_12_OU_MAIS_CARACTERES>
```

A senha deve satisfazer a politica do SQL Server (maiuscula, minuscula, numero e caractere especial); nao copie o marcador literal.

```bash
docker compose --env-file .env -f compose.sqlserver.yml up -d
docker compose -f compose.sqlserver.yml ps
docker logs hipersales-sqlserver --tail 100
```

Host local: `localhost,14333`; usuario administrativo inicial: `sa`. Conecte no Azure Data Studio, SSMS ou sqlcmd e crie o banco de homologacao:

```sql
IF DB_ID(N'hipersales') IS NULL CREATE DATABASE [hipersales];
```

**Atencao:** utilize o login administrativo apenas para inicializacao, nunca no DATABASE_URL final da API. Crie usuario especifico de menor privilegio, com senha protegida no ambiente. Porta exposta somente no loopback; para servidores remotos use tunel seguro. SQL Server Developer e exclusivo para desenvolvimento/teste, nao producao. O container exige arquitetura x86-64 e memoria suficiente.

## 2. Preparar conversao de aplicacao

1. Salvar um backup consistente do PostgreSQL **antes** de qualquer alteracao, com comando `pg_dump -Fc` e teste de restauracao em outra base.
2. Criar um novo Prisma schema para SQL Server; converter timestamps `@db.Timestamptz(6)` em `@db.DateTime2(6)` com politica UTC; revisar cascatas para impedir multiple cascade paths, indices, tipos `bit`, `decimal`, `varbinary(max)` e tamanhos `nvarchar`.
3. Introduzir `@prisma/adapter-mssql` na API e configurar a conexao SQL Server sem deixar o adaptador PostgreSQL ativo.
4. Reescrever e testar `database.service.ts` e cada SQL cru para dialeto T-SQL. Conferir consultas parametrizadas e transacoes.
5. Gerar migrations novas, especificas para SQL Server (nao reutilizar SQL de migrations PostgreSQL). Usar apenas homologacao limpa; nao executar `prisma db push` sobre producao.
6. Importar dados do snapshot PostgreSQL por tabela respeitando FKs, chaves compostas, IDs e `IDENTITY_INSERT`. Conferir row counts, checksums/amostras, senhas hash, anexos binarios, sequencias e integridade referencial.
7. Rodar build, typecheck, testes e smoke tests para login/sessoes, tenants, clientes, produtos, propostas, ocorrencias, relatorios, usuarios, outbox e jobs, incluindo a integracao Evolution.
8. Fazer cutover com escrita congelada e backup. Guardar PostgreSQL intacto para rollback; nunca escrever em dois bancos paralelamente sem reconciliacao.

## 3. URL de destino (somente depois da conversao)

Formato Prisma SQL Server com banco criado e login dedicado:

```text
sqlserver://localhost:14333;database=hipersales;user=hipersales_app;password={SENHA_URL_ENCODED};encrypt=true;trustServerCertificate=true
```

`trustServerCertificate=true` e aceitavel apenas no desenvolvimento local; para producao instale certificado confiavel e use `encrypt=true`. Verifique escaping de caracteres reservados na senha segundo o parser Prisma.

## 4. Nao executar ainda

- Nao apontar `DATABASE_URL` do PM2 para SQL Server.
- Nao desligar nem excluir o PostgreSQL atual.
- Nao usar `docker compose down -v`.
- Nao alterar o PostgreSQL da Evolution: ele continua necessario.

Proxima entrega: implementar a camada T-SQL + Prisma SQL Server e a transferencia com verificacoes antes da virada efetiva.
