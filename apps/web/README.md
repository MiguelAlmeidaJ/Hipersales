# HiperSales — frontend Next.js

Frontend em Next.js, React e TypeScript. A API de negócio é NestJS/TypeScript; o legado
Python já foi removido.

## Executar

API e Web são executados pelo PM2, nunca pelo Docker Compose. Na raiz do repositório:

```bash
pnpm install
pnpm install
pnpm build:api
pnpm build:web --prefix apps/web
pm2 startOrReload ecosystem.config.cjs
```

Para desenvolvimento, execute a API e o frontend em terminais separados:

```bash
pnpm dev:api
pnpm dev:web --prefix apps/web
```

Abra `http://localhost:3111`. O frontend consome o contrato versionado pelas rotas `/api/v1/*`.

## Verificações

```bash
npm run check:contracts --prefix apps/web
npm run audit:legacy --prefix apps/web
pnpm typecheck --prefix apps/web
pnpm build:web --prefix apps/web
```

Os componentes ficam agrupados por responsabilidade em `components/`: infraestrutura
visual em `layout`, autenticação em `auth`, composição em `modules` e uma pasta para cada
domínio funcional. Imports internos usam o alias `@/`.

Consulte `ARCHITECTURE.md` para a árvore e as regras de manutenção.
