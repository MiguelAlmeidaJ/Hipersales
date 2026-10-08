# Next.js + TypeScript — migração incremental

O app Next.js (App Router) e a camada de API tipada iniciam a substituicao da UI vanilla JS.

**Nao e uma reescrita concluida.** As paginas funcionais antigas continuam em `apps/web/modules` e sao oferecidas temporariamente pelo backend Python pelo fallback `/legacy`. O Next roda em outra porta e faz proxy de `/api/*` para preservar cookies, respostas e rotas. Os cards da nova home direcionam para a interface legada, nao para paginas React nativas.

## Desenvolvimento local

Terminal 1: `python apps/api/app.py`
Terminal 2: `cd apps/web && npm install && npm run dev`
Abra `http://localhost:3000`.

Para usar Docker, `docker compose up -d --build` (com o .env configurado). A porta do Next e 3000 e a do backend antigo e 8000.

## Prioridade da migracao

1. Conferir contrato de login/logout; tipar usuario, sessao e estado de autenticacao.
2. Reescrever dashboard e navegacao nativamente em React.
3. Clientes, produtos e empresas.
4. Propostas, pedidos, ocorrencias e relatorios.
5. Metas, configuracoes, superadmin e fluxos PWA.
6. Remover os arquivos JS legados e o fallback somente depois de homologar paridade funcional.

Nao habilitar a versao Next como frontend principal em producao sem testes de autenticacao e regressao.
