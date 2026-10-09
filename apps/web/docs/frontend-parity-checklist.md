# Etapa 5 — plano de validação da substituição do frontend

A execução dos testes locais será feita quando a migração funcional terminar, conforme combinado. Este documento define o aceite necessário antes de excluir o JavaScript legado.

## Verificações automatizadas
- `cd apps/web && npm install && npm run typecheck && npm run build`.
- Confirmar que a CI Next.js está ativa e aprovada.
- Comparar contratos JSON consumidos pelo Next.js com os endpoints da API Python.
- Verificar isolamento de tenant e bloqueio de rotas administrativas diretamente na API.

## Matriz de equivalência
- [ ] Login, logout, sessão expirada e troca obrigatória de senha.
- [ ] Navegação mobile e telas de 320px a 1440px.
- [ ] Administrador: CRUD de usuários e associações entre representantes, clientes e empresas.
- [ ] Cadastro e exclusão/inativação de clientes, indústrias e produtos com preservação de histórico.
- [ ] Aprovação e recusa de solicitações de clientes.
- [ ] Representante: criação de proposta com catálogo e clientes autorizados.
- [ ] Administrador: edição de pedidos, itens, descontos, status e histórico.
- [ ] Ocorrências: abertura, anexos, alteração de status e PDF.
- [ ] Metas: consulta e atualização de valores por mês.
- [ ] Relatórios PDF: todos os tipos suportados e filtros.
- [ ] Configurações: funis, status, SMTP e templates.
- [ ] Evolution API: QR, conexão, desconexão e notificações.
- [ ] Superadmin: consulta de tenants e criação isolada de tenant.
- [ ] Instalação PWA; avaliar cache e atualização antes de ativar offline.
- [ ] Comparar resultados reais com a branch `old`.
- [ ] Confirmar que não existem mais links necessários para `/legacy`.

## Regra para a etapa 6
Não remover `apps/web/app.js`, `apps/web/modules`, `apps/web/styles.css`, assets compartilhados, rewrites ou `/legacy` antes de todas as verificações críticas acima estarem aprovadas. O backend continua em SQLite até a migração separada para Postgres/Prisma.
