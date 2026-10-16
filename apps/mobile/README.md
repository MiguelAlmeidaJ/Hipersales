# HiperSales Mobile

Aplicativo Expo/React Native do HiperSales, integrado ao monorepo pnpm.

## Configuração

Copie `.env.example` para `.env.local` e ajuste `EXPO_PUBLIC_API_URL` para um endereço da API acessível pelo aparelho. Em um celular físico, use o IP da máquina na rede local (por exemplo, `http://192.168.0.10:8000`). O fallback automático usa `10.0.2.2:8000` no emulador Android e `localhost:8000` no iOS. Produção aceita somente HTTPS.

Configure também `EXPO_PUBLIC_PRIVACY_URL` e `EXPO_PUBLIC_SUPPORT_URL`. A primeira é obrigatória antes de um build de loja.

Na raiz do repositório:

```bash
pnpm install
pnpm dev:api
pnpm dev:mobile
```

Escaneie o QR code com Expo Go ou pressione `a` para abrir o emulador Android.

## Estrutura inicial

- autenticação mobile dedicada e token protegido por Keychain/Android Keystore;
- troca obrigatória de senha;
- dashboard conectado aos endpoints por perfil;
- pedidos com busca, filtros, totais, itens e histórico;
- criação de propostas em três etapas, com produtos, condições comerciais e validação antes do envio;
- clientes com busca, dados cadastrais e ações de contato;
- cadastro direto de clientes para administradores e solicitação para aprovação para representantes;
- módulos nativos de empresas, produtos, aprovações, ocorrências, metas, usuários e carteiras;
- relatórios em PDF baixados com autenticação e compartilhados pelo sistema do aparelho;
- configurações nativas de SMTP, WhatsApp, funis e status de pedidos;
- navegação inferior para início, pedidos, clientes e perfil;
- identidade visual compartilhada com o portal web.

## Publicação

Os documentos de privacidade, conteúdo de loja e processo de release ficam em [`docs/mobile`](../../docs/mobile). Antes de um build de produção, execute:

```bash
pnpm --filter @hipersales/mobile validate:release
```

## API versionada

Configure `EXPO_PUBLIC_API_URL` com a base `https://api.hipersalesweb.com.br/api/v1`. No desenvolvimento local, por exemplo, use `http://192.168.0.10:3110/api/v1`. Para preservar configurações anteriores, o app acrescenta `/api/v1` automaticamente quando a variável contém apenas a origem do servidor.

Todos os módulos operacionais possuem tela nativa e usam `EXPO_PUBLIC_API_URL`; o aplicativo não depende da URL do portal web.

## Tamanho do Android

O perfil `preview` gera um APK universal para instalação direta e, por isso, inclui binários para diferentes aparelhos. O perfil `production` gera AAB: a Play Store entrega somente a arquitetura e os recursos necessários para cada dispositivo. Builds release também usam R8, remoção de recursos não utilizados e compressão do bundle JavaScript.
