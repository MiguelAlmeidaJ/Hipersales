# Hipersales — frontend Next.js

O frontend principal utiliza Next.js, TypeScript e Tailwind CSS. Os arquivos antigos `app.js`, `index.html`, `modules/`, `styles.css` e `styles/` foram removidos da branch `main`. A branch `old` mantém o histórico original.

A API de negócio permanece em Python com SQLite neste estágio. O banco PostgreSQL/Prisma ainda exige uma migração de backend separada. A Evolution API funciona via Docker.

## Executar com PM2 (sem Docker para API/Web)

A configuração oficial para API e Web separados está na raiz em `ecosystem.config.cjs`. Consulte [o guia PM2](../../../docs/pm2-deploy.md) para instalação, build, inicialização e reinício dos dois processos.

## Alternativa com Docker

No diretório raiz do repositório, configure o `.env` com as variáveis exigidas no `docker-compose.yml` e execute:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f web hipersales
```

Abra http://localhost:3000. O backend usa a porta 8000 e é consumido pelo frontend através das rotas `/api/*`. Em instalações sem Docker, execute `python apps/api/app.py` e, em outro terminal, `cd apps/web && npm install && npm run dev`.

## Verificações

```bash
cd apps/web
npm install
npm run check:contracts
npm run audit:legacy
npm run typecheck
npm run build
```

O script de auditoria confere dependências e arquivos antigos; isso não garante paridade funcional. A validação manual deve seguir `docs/frontend-parity-checklist.md`, com contas dos perfis representante, administrador e superadmin.

## Arquivos compartilhados

`apps/web/assets/` permanece porque o backend usa as imagens em templates de e-mail, além de fornecê-las ao Next pela rota `/assets/*`. Não remover sem migrar o mecanismo de imagens do backend.

## Critérios de aceite

Antes de usar em produção, validar login e recuperação de sessão, permissões, emissão/edição de pedidos, gestão de clientes e empresas, propostas, geração de PDFs, metas, relatórios e Evolution API. O PWA tem manifesto Next.js, mas o funcionamento offline e o service worker ainda necessitam homologação.
