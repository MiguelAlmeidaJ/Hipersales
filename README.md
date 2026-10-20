# HiperSales Mobile

Aplicativo independente em **Expo / React Native / TypeScript**. O código da antiga retaguarda (web, API NestJS, banco de dados, infraestrutura e histórico) está preservado na branch [Retaguarda](https://github.com/MiguelAlmeidaJ/Hipersales/tree/Retaguarda).

## Desenvolvimento

Requisitos: Node.js 22+ e pnpm 10+.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm start
```

Use `pnpm android`, `pnpm ios` ou `pnpm web`. Para verificar o projeto: `pnpm check`. Para validar o ambiente de loja: `pnpm validate:release`.

## Integração com a API externa

Configure `EXPO_PUBLIC_API_URL` com o endereço acessível pelo dispositivo. O cliente atual preserva **temporariamente** a interface REST antiga (rotas `/api/v1`, token Bearer e formatos de payload existentes) para manter as telas intactas. A integração definitiva depende do contrato da nova API; não assuma compatibilidade sem validá-la.

Nunca coloque chaves privadas nas variáveis `EXPO_PUBLIC_*`. Para produção, a API deve usar HTTPS. As demais configurações públicas estão em `.env.example`.

## Builds

O aplicativo possui `eas.json` para APK de preview e AAB de produção. A configuração EAS e identificadores das lojas foram preservados.
