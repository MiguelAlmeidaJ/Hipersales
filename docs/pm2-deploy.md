# Hipersales: executar API e Web pelo PM2 (sem Docker)

Execute a partir da **raiz do repositório** em Linux/Ubuntu. Pré-requisitos: Python 3.11+ (recomendado 3.12), Node.js 22+, npm e PM2. Não é necessário Docker para a API Python nem para o Next.js.

> A API continua usando SQLite. Evolution API, PostgreSQL e Redis usados pela integração WhatsApp **não são iniciados por este PM2**; configure a Evolution separadamente. Não confunda o banco PostgreSQL da Evolution com o SQLite do Hipersales.

## Primeira instalação

```bash
git pull origin main
cp -n .env.example .env
# Edite .env: chaves, URLs públicas e cookies HTTPS conforme ambiente.
npm install -g pm2
cd apps/web
npm install
npm run check:contracts
npm run audit:legacy
npm run typecheck
npm run build
cd ../..
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs hipersales-api
pm2 logs hipersales-web
```

Acesse `http://127.0.0.1:3000` **no servidor**. Por padrão, a API escuta somente em `127.0.0.1:8000` e o Next.js em `127.0.0.1:3000`; para abrir de outro computador configure proxy reverso (Nginx, Caddy, etc.), incluindo HTTPS. Exponha somente o Next pelo proxy; as requisições `/api/*` são encaminhadas internamente à API.

A API Python carrega o arquivo `.env` da raiz. Para um caminho personalizado exporte `HYPERSALES_ENV_FILE` ao iniciar o PM2. Para apontar o Next a outra API, exporte `HIPERSALES_API_ORIGIN` antes de compilar/iniciar, depois reinicie o processo.

## Reinicialização e atualização

```bash
git pull origin main
cd apps/web && npm install && npm run build && cd ../..
pm2 restart ecosystem.config.cjs --update-env
pm2 status
```

Para iniciar automaticamente após reiniciar o Linux:

```bash
pm2 save
pm2 startup
```

Execute também o comando `sudo ...` apresentado por `pm2 startup`; depois execute `pm2 save` novamente. O PM2 deve rodar sob a conta do usuário responsável pela aplicação, **não como root**.

## Comandos úteis

```bash
pm2 list
pm2 logs hipersales-api --lines 80
pm2 logs hipersales-web --lines 80
pm2 restart hipersales-api
pm2 restart hipersales-web
pm2 stop ecosystem.config.cjs
pm2 delete ecosystem.config.cjs
```

Caso a execução do Python dependa de virtualenv, defina `HIPERSALES_PYTHON=/caminho/.venv/bin/python` antes de executar o comando `pm2 start`.

## Segurança e operação

- O backend Python inicializa tarefas agendadas no processo. Por isso, **uma única instância da API**; não ative `cluster` ou múltiplas instâncias sem separar os agendadores.
- A aplicação grava no SQLite local; configure `HYPERSALES_DB_PATH` se necessário e faça backup antes de deploys.
- Ajuste `HYPERSALES_PUBLIC_URL` para a URL **pública** que receberá webhooks da Evolution. Para acesso externo, ative HTTPS e `HYPERSALES_COOKIE_SECURE=true`.
- Não divulgue `.env`, tokens de sessão ou chaves da Evolution.
- PM2 não instala Evolution API, PostgreSQL nem Redis. Se desativar esses serviços Docker, será necessário hospedar seus equivalentes de maneira independente.
- Faça a homologação de rotas, autenticação, geração de pedidos/PDFs e WhatsApp antes de produção.
