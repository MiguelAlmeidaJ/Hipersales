# Frontend Hipersales: organização Next.js App Router

A aplicação utiliza **rotas de verdade**, um único layout autenticado, navegação por links Next e módulos independentes.

```text
apps/web/
├── app/
│   ├── layout.tsx              # Layout HTML global
│   ├── page.tsx                # / -> /app/painel
│   └── (workspace)/            # Route group (fora da URL)
│       └── app/
│       ├── layout.tsx          # Shell persistente autenticado
│       ├── page.tsx            # /app -> /app/painel
│       ├── painel/page.tsx
│       ├── pedidos/page.tsx
│       ├── ocorrencias/page.tsx
│       ├── clientes/page.tsx
│       ├── empresas/page.tsx
│       ├── produtos/page.tsx
│       ├── relatorios/page.tsx
│       ├── metas/page.tsx
│       ├── usuarios/page.tsx
│       ├── configuracoes/page.tsx
│       ├── aprovacoes/page.tsx
│       └── solicitar-cliente/page.tsx
├── components/
│   ├── app-shell.tsx           # Sessão, autenticação e sidebar persistentes
│   ├── module-page.tsx         # Contexto de sessão -> renderizador
│   ├── module-renderer.tsx     # Composição e autorização das telas
│   ├── read-only-catalog.tsx   # Listagem para representantes
│   └── ...                    # Funcionalidades existentes preservadas
└── lib/
    ├── navigation.ts           # Mapa tipado: rotas, grupos, ícones, visibilidade
    └── api.ts
```

## Recomendações para novas telas

1. Criar `app/(workspace)/app/<rota>/page.tsx` com `<ModulePage module="..." />`.
2. Registrar rota e permissões em `lib/navigation.ts`.
3. Reutilizar o layout e a sessão em `components/app-shell.tsx`.
4. Concentrar operações específicas em seus componentes; não duplicar sidebar, login e acesso a dados.
5. Validar permissões no **backend** também (o filtro de navegação é apenas UX).

## Homologação local

```bash
git pull origin main
cd apps/web
npm run typecheck
npm run check:contracts
npm run build
cd ../..
pm2 restart hipersales-web
```

Abrir `http://localhost:3000/app/painel`; navegar pelo menu e verificar que a URL muda. Testar login, logout, perfil admin e representante, inclusive acesso direto digitando uma URL não permitida. O backend e o banco não precisam ser migrados para esta mudança de navegação.

**Nota:** o layout Next é persistente entre rotas do grupo `/app`. O provedor da sessão preserva login durante a navegação, enquanto cada `page.tsx` renderiza apenas seu módulo.
