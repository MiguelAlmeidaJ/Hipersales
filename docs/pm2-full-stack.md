# Instalação SEM Docker: PostgreSQL + Redis via systemd; API, Web e Evolution via PM2

> **Estado do sistema:** o Hipersales ainda usa `sqlite3` no backend Python. O Prisma em `packages/database` é um esquema preliminar, não um adaptador em produção. Levantar o PostgreSQL **não transfere nem converte** os dados SQLite. Até a implementação e homologação do adaptador PostgreSQL, preserve o SQLite original e não o apague.

## 1. Dependências (Ubuntu)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib redis-server git python3 nodejs npm
sudo systemctl enable --now postgresql redis-server
sudo systemctl status postgresql redis-server --no-pager
npm install -g pm2
```

Use uma versão suportada de Node para o Next.js (recomendado Node 22) e para a release da Evolution escolhida. Mantenha o PostgreSQL e o Redis sob **systemd**, e não PM2.

## 2. Bancos separados e usuários próprios

Crie senhas longas para cada aplicação. Na sessão administrativa `sudo -u postgres psql` execute, adaptando as senhas:

```sql
CREATE ROLE hipersales LOGIN PASSWORD 'SENHA_LONGA_HIPERSALES';
CREATE DATABASE hipersales OWNER hipersales;
CREATE ROLE evolution LOGIN PASSWORD 'SENHA_LONGA_EVOLUTION';
CREATE DATABASE evolution OWNER evolution;
```

No PostgreSQL local, teste com `psql -h 127.0.0.1 -U hipersales -d hipersales -c 'select 1;'` e repita para evolution. Restrinja as portas 5432 e 6379 ao loopback / firewall local; **não exponha** esses serviços à Internet.

## 3. Evolution API v2 sem Docker

A versão usada anteriormente no Docker era **2.2.3**. Para preservar contratos de QR/webhook, faça checkout de uma tag compatível — **confirme se a tag está disponível** no repositório oficial antes da instalação.

```bash
mkdir -p services
git clone https://github.com/EvolutionAPI/evolution-api.git services/evolution-api
cd services/evolution-api
git tag -l '*2.2.3*'
# Se existir a tag adequada: git checkout <tag>
npm install
cp -n .env.example .env
```

Configure no `services/evolution-api/.env` os campos da release instalada, incluindo:

```dotenv
SERVER_PORT=8081
SERVER_URL=http://127.0.0.1:8081
AUTHENTICATION_API_KEY=CHAVE_ALEATORIA
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:SENHA_LONGA_EVOLUTION@127.0.0.1:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=hipersales_evolution
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://127.0.0.1:6379/1
CACHE_REDIS_PREFIX_KEY=hipersales_evolution
CACHE_LOCAL_ENABLED=false
```

Se a senha contiver símbolos reservados de URL, codifique-os na string de conexão. Confirme o nome correto da variável de porta na versão escolhida e não publique 8081 externamente.

```bash
npm run db:generate
npm run db:deploy
npm run build
cd ../..
```

Os comandos de instalação e migração da Evolution API seguem a documentação oficial da v2, mas devem ser conferidos contra a tag efetivamente instalada. Esses comandos **migram só o banco da Evolution**, não o banco comercial do Hipersales.

## 4. API e Next.js

Edite o `.env` da raiz:

```dotenv
EVOLUTION_API_URL=http://127.0.0.1:8081
EVOLUTION_API_KEY=MESMA_CHAVE_ALEATORIA
HYPERSALES_PUBLIC_URL=https://SEU_DOMINIO
HYPERSALES_COOKIE_SECURE=true
DATABASE_URL=postgresql://hipersales:SENHA_LONGA_HIPERSALES@127.0.0.1:5432/hipersales?schema=public
```

**Atenção:** `DATABASE_URL` ainda não é consumida pelo backend Python, que segue lendo `HYPERSALES_DB_PATH`/SQLite. Não desligue a base SQLite antes de validar a migração de código e dados.

```bash
cd apps/web
npm install
npm run check:contracts
npm run audit:legacy
npm run typecheck
npm run build
cd ../..
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs hipersales-evolution --lines 80
pm2 logs hipersales-api --lines 80
pm2 logs hipersales-web --lines 80
```

Se o código da Evolution estiver em outro diretório, exporte `HIPERSALES_EVOLUTION_DIR=/caminho/absoluto/evolution-api` antes de executar PM2. Execute `pm2 save` e `pm2 startup` para persistência.

## 5. Migração SQLite → PostgreSQL do Hipersales: condição para produção

1. Congelar gravações e fazer backup consistente do arquivo SQLite.
2. Revisar o esquema Prisma (campos, FKs, índices e tipos, incluindo os relacionamentos e anexos) e criar migrações SQL reproduzíveis.
3. Implementar um adaptador PostgreSQL **para toda a API Python** ou substituir a API por uma implementação que use Prisma. Hoje o backend executa `sqlite3.connect`, parâmetros `?`, comandos SQLite e operações específicas de SQLite; somente copiar tabelas não é suficiente.
4. Migrar os registros preservando IDs e associações multi-tenant, reajustar sequences de IDs, validar integridade referencial e contagem/valores por tabela.
5. Fazer testes de login, CRUD, pedidos, anexos, relatórios, metas e transações em uma cópia; só então efetuar cutover com rollback documentado.

**Não executar `prisma db push` no banco comercial contendo dados sem revisão prévia.** A base da Evolution e a base Hipersales são independentes.
