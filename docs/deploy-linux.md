# Deploy Linux — HiperSales

## Endereços

- Web: https://web.hipersalesweb.com.br → Next.js em 127.0.0.1:3111
- API: https://api.hipersalesweb.com.br → NestJS em 127.0.0.1:3110
- Futuro domínio principal: hipersalesweb.com.br (não redirecionar por enquanto)
- SQL Server: Docker, somente 127.0.0.1:14333, banco interno 1433
- Evolution API: Docker, somente 127.0.0.1:8081

As rotas /api/* do Next.js são redirecionadas internamente à API pelo `apps/web/next.config.ts`. **Não** configure `NEXT_PUBLIC_API_URL` nem direcione o navegador à API diretamente. O login usa cookie de sessão no host da Web e a rota /api é encaminhada ao backend pelo servidor Next. Os dois serviços têm endereços DNS próprios para testes e integrações.

## 1. Pré-requisitos

Ubuntu/Debian recente com acesso sudo, DNS apontado ao IP do servidor, Node.js 22+, pnpm 10 via Corepack, Git, Docker Engine com Compose, PM2, Nginx e Certbot.

Criar registros DNS A (e AAAA somente se IPv6 estiver configurado) para:
- api.hipersalesweb.com.br
- web.hipersalesweb.com.br

Na Cloudflare, recomenda-se começar com **Somente DNS** até emissão dos certificados. Depois, se usar proxy Cloudflare, manter modo SSL/TLS **Full (strict)**. Não usar Flexible.

Instalação dos utilitários com pacotes do sistema (Docker e Node devem vir dos respectivos repositórios oficiais e versões suportadas):

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx git
node -v
docker compose version
corepack enable
corepack prepare pnpm@10.18.3 --activate
npm install -g pm2
```

## 2. Instalar monorepo e configurar segredos

Exemplo de diretório: `/opt/hipersales`. O usuário Linux de deploy precisa ser proprietário do diretório e executar PM2.

```bash
sudo mkdir -p /opt/hipersales
sudo chown "$USER":"$USER" /opt/hipersales
git clone https://github.com/MiguelAlmeidaJ/Hipersales.git /opt/hipersales
cd /opt/hipersales
cp .env.example .env
cp .env.infrastructure.example .env.infrastructure
chmod 600 .env .env.infrastructure
${EDITOR:-nano} .env
${EDITOR:-nano} .env.infrastructure
```

Configurar no `.env` (somente exemplos de valores públicos):

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3110
HYPERSALES_PUBLIC_URL=https://api.hipersalesweb.com.br
HYPERSALES_ALLOWED_ORIGINS=https://web.hipersalesweb.com.br
HYPERSALES_COOKIE_SECURE=true
HYPERSALES_COOKIE_SAMESITE=Lax
TRUST_PROXY=1
HIPERSALES_API_ORIGIN=http://127.0.0.1:3110
EVOLUTION_API_URL=http://127.0.0.1:8081
```

Manter também as demais variáveis do arquivo original, incluindo `SQLSERVER_DATABASE_URL`, `EVOLUTION_API_KEY` e tokens reais fortes. Para banco hospedado no mesmo Docker Compose, a URL SQL Server deve apontar a `localhost:14333` para a API rodando no host (não a `database:1433`, que é nome DNS apenas dentro da rede Docker). Senha SQL da aplicação não deve ser `sa`. Se certificados SQL forem válidos, preferir `trustServerCertificate=false`.

**Atenção:** o volume de SQL Server chama-se `hipermix_hipersales_sqlserver` no compose por compatibilidade. Não renomeie nem execute `docker compose down -v`: isso pode fazer o banco não encontrar o volume anterior ou remover dados. Em servidor novo, o banco estará vazio até restauração/importação segura.

```bash
pnpm install --frozen-lockfile
pnpm env:check:local
docker compose --env-file .env --env-file .env.infrastructure up -d
docker compose --env-file .env --env-file .env.infrastructure ps
```

Antes de iniciar a API, provisionar o usuário SQL Server da aplicação e aplicar migrations usando o procedimento do `docs/database.md` e um backup verificado. Não executar migrations em banco importado até confirmar o estado das migrations:

```bash
pnpm prisma:validate
pnpm build
pnpm pm2:up
pm2 status
pm2 logs hipersales-api --lines 80
pm2 logs hipersales-web --lines 80
```

Iniciar PM2 no boot como o usuário de deploy:

```bash
pm2 save
pm2 startup
```

Executar o comando `sudo ...` que o próprio PM2 apresentar e então `pm2 save` novamente.

## 3. Proxy Nginx e HTTPS

Instale a configuração incluída em `infra/nginx/hipersales.conf`:

```bash
sudo cp infra/nginx/hipersales.conf /etc/nginx/sites-available/hipersales
sudo ln -s /etc/nginx/sites-available/hipersales /etc/nginx/sites-enabled/hipersales
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d web.hipersalesweb.com.br -d api.hipersalesweb.com.br --redirect
```

Se já existir arquivo/link, revise-o antes de substituí-lo. Portas 80 e 443 devem estar abertas ao público; 3110, 3111, 14333 e 8081 devem continuar acessíveis **apenas localmente**. Não publique `.env`, `.env.infrastructure`, Docker API ou diretório de uploads no Nginx.

O Certbot gerencia a configuração HTTPS e renovação. Após emitir, teste:

```bash
sudo nginx -t
curl -I https://web.hipersalesweb.com.br
curl -I https://api.hipersalesweb.com.br/api/me
curl -I https://web.hipersalesweb.com.br/api/me
```

As rotas `/api/me` podem responder 401 sem sessão; isso confirma que há uma API respondendo. Verifique o login no navegador e PDF de pedido. A API pública isolada **não** compartilha automaticamente cookie com o frontend — é esperado.

## 4. Atualização

```bash
cd /opt/hipersales
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm build
pnpm pm2:up
pm2 save
```

Se uma atualização trouxer migrations, consulte `docs/database.md`, tire backup e execute o procedimento adequado **antes** de recarregar processos. Verificar `pm2 logs` e as rotas HTTPS.

## 5. Checklist

- DNS dos dois subdomínios resolve para servidor
- HTTPS válido em ambos
- API e Web escutam só em 127.0.0.1
- Next encaminha /api para a API local; cookies Secure, SameSite=Lax
- SQL Server existente restaurado/provisionado com usuário de privilégio mínimo
- Evolution API e suas instâncias preservadas
- PM2 reinicia após reboot
- Login, upload, PDF, pedidos, relatórios e WhatsApp testados
