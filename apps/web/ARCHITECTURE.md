# Frontend HiperSales: organização Next.js App Router

A aplicação usa rotas do App Router, um layout autenticado persistente e componentes
agrupados pela responsabilidade que exercem.

```text
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── (workspace)/app/
│       ├── layout.tsx
│       └── <módulo>/page.tsx
├── components/
│   ├── auth/          # sessão e troca de senha
│   ├── layout/        # shell, cabeçalho e navegação lateral
│   ├── modules/       # ligação entre rota, sessão e módulo funcional
│   ├── catalog/
│   ├── customers/
│   ├── dashboard/
│   ├── goals/
│   ├── occurrences/
│   ├── orders/
│   ├── reports/
│   ├── settings/
│   └── users/
└── lib/
    ├── api.ts
    └── navigation.ts
```

## Regras de manutenção

1. Coloque cada componente na pasta do domínio que o utiliza.
2. Mantenha shell e navegação em `components/layout` e autenticação em `components/auth`.
3. Use imports diretos com o alias `@/`; não crie arquivos de barril (`index.ts`).
4. Registre novas rotas e permissões em `lib/navigation.ts`.
5. Trate o filtro de navegação apenas como UX; a autorização obrigatória fica na API.
6. Extraia componentes quando houver uma responsabilidade reutilizável, evitando divisão
   artificial de JSX curto.

Para uma nova tela, crie `app/(workspace)/app/<rota>/page.tsx`, registre o módulo em
`lib/navigation.ts` e implemente a interface na pasta funcional correspondente.

## Validação

```bash
npm run format:check --prefix apps/web
npm run typecheck --prefix apps/web
npm run check:contracts --prefix apps/web
npm run build --prefix apps/web
pm2 restart hipersales-web
```
