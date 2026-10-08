# Estado real da migração Next.js

A nova interface React contém login, logout, navegação por permissões e consultas nativas para dashboard, pedidos, clientes, indústrias, produtos, ocorrências, metas, usuários e configurações. O frontend anterior ainda contém operações e formulários não portados. O link "Sistema clássico" garante continuidade.

**Não excluir os módulos JavaScript antigos nem alterar o backend neste ponto.** A equivalência funcional ainda não foi demonstrada. Antes da remoção, converter operações de CRUD, solicitações de cadastro, geração de propostas e PDFs, relatórios, metas, modais, anexos, superadmin e PWA.

## Executar
```bash
python apps/api/app.py
cd apps/web && npm install && npm run dev
```
Acessar http://localhost:3000. A API atual continua em http://localhost:8000; o Next realiza proxy same-origin dos endpoints e dos recursos legados.

## Testes obrigatórios antes do cutover
- Validar build TypeScript, autenticação e logout (cookies).
- Comparar respostas e permissões por perfil e tenant.
- Validar todos os formulários, efeitos colaterais, status de pedidos e relatórios.
- Confirmar upload de anexos, PDFs e WhatsApp.
- Confirmar responsividade e funcionamento PWA.
