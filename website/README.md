# Site institucional HiperSales

Projeto Next.js na branch `web`, dentro da pasta `website/`. Porta padrão: **3010**.

## Desenvolvimento local

Requer Node.js 20+.

```bash
cd website
npm install
npm run dev
```

Acesse `http://localhost:3010`.

## Produção com PM2

No servidor, dentro da pasta `website/`:

```bash
npm ci
npm run build
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Execute o comando adicional que o `pm2 startup` imprimir para habilitar inicialização automática após reboot.

Atualizações posteriores:

```bash
git pull origin web
cd website
npm ci
npm run build
pm2 reload hipersales-web --update-env
pm2 save
```

Inspeção:

```bash
pm2 status
pm2 logs hipersales-web
curl -I http://127.0.0.1:3010
```

O PM2 usa `127.0.0.1:3010`; exponha HTTPS via reverse proxy (Nginx/Caddy) no domínio público. O PM2 inicia o servidor **após** `npm run build`. Não utilize `next dev` com PM2 para produção.

## Configurações e publicação

Copie `.env.example` para `.env.local` e preencha os contatos e dados legais oficiais. A política está marcada como **minuta**, e precisa validar responsável legal, fornecedores, segurança, retenção e contato antes de ser usada na Google Play.

Não sobrescreva o domínio da retaguarda sem verificar o roteamento atual. O site deve receber um domínio/subdomínio próprio ou um caminho configurado por reverse proxy. Se mudar a origem, ajuste `metadataBase` e URLs de sitemap.

Após publicar, configure no mobile `EXPO_PUBLIC_PRIVACY_URL` com o endereço HTTPS da política.
