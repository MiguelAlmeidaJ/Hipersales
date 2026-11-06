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

Configure `EXPO_PUBLIC_API_URL` com o endereço acessível pelo dispositivo. O adaptador do aplicativo traduz a interface interna das telas para o contrato da HiperSales API v1, incluindo clientes, tabelas de preço, prazos, produtos, pedidos, vendas, notas fiscais, notificações e push tokens. Respostas paginadas, datas no formato `DD/MM/AAAA` e nomes de campos em português são normalizados antes de chegar às telas.

Ocorrências e metas do representante fazem parte do contrato definitivo da HiperSales API v1. A administração de ocorrências também está integrada. As demais rotas administrativas da plataforma antiga (usuários, cadastro de metas, configurações e manutenção de catálogo) ficaram fora do mock atual; o app não exibe ações sem contrato publicado.

Para a consulta comercial de tabelas, `GET /tabelas-preco` deve devolver somente as tabelas associadas ao representante autenticado (administradores podem usar o escopo previsto pelo servidor). O compartilhamento usa o PDF oficial retornado por `GET /tabelas-preco/{id}/pdf`; essa rota deve validar o vínculo do usuário com a tabela e responder com `Content-Type: application/pdf`.

Nunca coloque chaves privadas nas variáveis `EXPO_PUBLIC_*`. Para produção, a API deve usar HTTPS. As demais configurações públicas estão em `.env.example`.

### Ambiente mock para testes web

Para navegar sem acessar a API externa, defina no `.env.local`:

```env
EXPO_PUBLIC_USE_MOCK_API=true
```

Depois execute `pnpm web --clear`. Use **demo** / **demo123** para testar a visão do vendedor ou **admin** / **admin123** para testar consultas administrativas e o tratamento de ocorrências. O mock reproduz somente os módulos publicados na API definitiva e gera um PDF demonstrativo do pedido de venda no detalhe de cada pedido. Os dados vêm de `src/mocks/api-data.json`; novos pedidos, clientes, ocorrências e pareceres permanecem em memória até recarregar a página. Como nenhuma requisição externa é feita nesse modo, não é necessário liberar `localhost:8081` no CORS.

Para testar contra a API real pelo web, mantenha o mock desligado e libere na API as origens `http://localhost:8081` e `http://127.0.0.1:8081` (ou a porta exibida pelo Expo).

## Builds

O aplicativo possui `eas.json` para APK de preview e AAB de produção. A configuração EAS e identificadores das lojas foram preservados.

Antes do envio, siga o checklist em [STORE_RELEASE.md](./STORE_RELEASE.md). A validação local é feita com `pnpm validate:release`; o build de produção também executa essa validação automaticamente.

O contrato completo de requisições esperadas pelo aplicativo está em [API_REQUIREMENTS.md](./API_REQUIREMENTS.md).
