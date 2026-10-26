# Site institucional HiperSales

Projeto Next.js na branch `web`, pasta `website/`, separado do app mobile.

## Rodar localmente

Requer Node.js 20+. Em `website/`, execute `npm install` e `npm run dev`.

## Configuração antes do deploy

Copie `.env.example` para `.env.local` e informe os contatos e os dados legais oficiais. O texto jurídico está sinalizado como minuta e NÃO deve ser usado para preencher a Google Play sem completar controlador, contato, compartilhamento e retenção de dados e passar por revisão jurídica.

Na Vercel configure Root Directory=`website`. Antes de vincular `hipersalesweb.com.br`, confirme se o domínio já hospeda a retaguarda; nesse caso considere um subdomínio separado e atualize os metadados.

Depois do deploy, configure no app mobile `EXPO_PUBLIC_PRIVACY_URL` com a URL HTTPS pública definitiva.
