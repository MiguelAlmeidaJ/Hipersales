# API HiperSales

O ponto de entrada publico e agora NestJS/TypeScript. As fatias migradas incluem autenticacao, health check e consultas de empresas e produtos (administrador e representante). Os demais dominios
continuam no processo Python interno e sao encaminhados pelo Nest sem alterar as
rotas `/api/*`; esse proxy e uma ponte temporaria, nao uma arquitetura final.

## Desenvolvimento

Na raiz do repositorio:

```bash
npm install
npm run build:api
```

Inicie o legado na porta interna e depois o Nest:

```powershell
$env:PORT=8001; python apps/api/app.py
$env:LEGACY_API_ORIGIN="http://127.0.0.1:8001"; npm run dev --workspace @hipersales/api
```

O frontend continua chamando somente a porta publica `8000`.

## Estrutura nova

- `src/auth`: sessao e credenciais, preservando o hash PBKDF2 e o cookie legado.
- `src/common/guards`: autenticacao fechada por padrao e autorizacao por papel.
- `src/common/middleware`: verificacao de origem para requisicoes mutaveis.
- `src/database`: acesso SQLite encapsulado para a fase de compatibilidade.
- `src/legacy`: proxy isolado que desaparecera conforme cada dominio for portado.
- `packages/contracts`: schemas Zod e tipos compartilhados com o frontend.

Novos controllers devem declarar `@Public()` apenas quando realmente publicos;
o `SessionGuard` global exige sessao em todos os outros. Rotas administrativas
devem declarar `@Roles("admin")`.

## Ordem recomendada da migracao

1. Homologar as escritas de catalogo no Nest e migrar importacao/exportacao. Revisar exclusao de empresa, pois o legado apaga pedidos em cascata.
2. Clientes, usuarios e vinculos.
3. Propostas e ocorrencias.
4. Dashboard, metas e relatorios.
5. Integracoes, webhooks e jobs; entao remover `LegacyProxyMiddleware` e Python.

## Fase de transicao do catalogo

Consultas e escritas basicas de empresas e produtos agora sao atendidas pelo Nest. Migradas: GET /api/companies, GET /api/products, GET /api/admin/companies, GET /api/admin/products; POST/PATCH de empresas; POST/PATCH/DELETE de produtos. As regras de associacao de representante, tenant_id, unicidade de codigo e bloqueio de exclusao de produto com historico foram preservadas. Exclusao de empresa (destrutiva, remove pedidos), importacao de produtos e exportacao CSV continuam no Python.

Validacao antes de reiniciar a API:

```bash
npm ci
npm run build:api
npm run test:api
```

Somente depois de os comandos passarem, garanta que `hipersales-api-legacy` esta online na porta 8001 e reinicie `hipersales-api` via PM2. Nao desligue o Python nem troque o banco nesta fase.

## Etapa de transferencia de produtos

Os endpoints `GET /api/admin/products/export` e `POST /api/admin/products/import` passaram para NestJS. O CSV mantém as mesmas colunas do legado, e a importação usa uma transação única com rollback em caso de dados inválidos. O limite por lote é de 10.000 registros. A exclusão de empresas permanece no Python; o comportamento destrutivo do legado não deve ser reproduzido sem revisão das relações com pedidos.

Validar antes de implantar: `npm run build:api` e `npm run test:api`. Manter os processos Nest e Python durante a transição.

## Etapa de clientes (consultas)

As rotas `GET /api/customers` e `GET /api/admin/customers` passaram para o `CustomersModule` no NestJS. Foram preservados filtros de busca, vínculo de representante, isolamento por `tenant_id`, campos adicionais de vendedores e enriquecimento dos dados básicos do formulário. Cadastro, edição, exclusão, validação de CNPJ com consulta externa, vínculos e notificações continuam no Python para evitar regressões. Esta etapa não altera o banco e não remove o processo legado.

Executar `npm run build:api` e `npm run test:api` antes de implantar. Comparar os resultados com a API anterior em um banco de testes, especialmente os campos de endereço preenchidos via `form_payload`.

## Escritas de clientes em homologacao

O `CustomersWriteService` implementa criar, atualizar e excluir clientes, com transacoes, verificacao de CNPJ normalizado por empresa e bloqueio de exclusao quando existem pedidos. As rotas `POST /api/admin/customers`, `PATCH /api/admin/customers/:id` e `DELETE /api/admin/customers/:id` foram adicionadas ao Nest.

**Compatibilidade incompleta:** o Python realiza consulta externa de CNPJ ao salvar e enriquece automaticamente campos de endereco, inscricao estadual e contato. A implementacao Nest atual nao consulta essa fonte externa, e a validacao dos digitos verificadores do CNPJ nao foi portada. Portanto, o proxy continua encaminhando escritas para Python por padrao.

A variavel `HIPERSALES_NEST_CUSTOMER_WRITES=true` habilita as escritas Nest **somente para homologacao controlada**, em uma base de testes. Nao habilitar em producao ate que os testes de equivalencia, campos enriquecidos e regras de vinculos estejam completos.

### Etapas restantes estimadas

1. Equivalencia completa de clientes e CNPJ; aprovar escrita Nest.
2. Vinculos de representantes e fluxos de aprovacao de cadastro.
3. Pedidos/propostas, itens, estados, autorizacoes e arquivos PDF.
4. Ocorrencias e historico de eventos.
5. Dashboard, indicadores, metas e relatorios.
6. Configuracoes, usuarios e permissoes remanescentes.
7. Integracoes externas e workers (WhatsApp, e-mail, notificacoes, agendamentos).
8. Homologacao final, migracao da persistencia PostgreSQL se desejada, desligamento do proxy/Python e limpeza do legado.

Oito etapas representam uma estimativa tecnica e podem ser subdivididas apos a auditoria de cada dominio.

## Compatibilidade de campos cadastrais

O arquivo `src/customers/customer-fields.ts` centraliza as regras de composição de endereço e contatos antes implementadas em `foundation.py`. As consultas e escritas Nest compartilham agora esses auxiliares, inclusive para formulários legados com campos em `row`. Os cenários mínimos são exercitados em `test/customer-fields.spec.ts`.

**Ainda pendente:** consulta externa de CNPJ (CNPJ.ws e BrasilAPI), normalização integral do retorno, equivalência dos enriquecimentos remotos e homologação contra amostras reais. Por isso, `HIPERSALES_NEST_CUSTOMER_WRITES` deve permanecer desativado em produção. Nenhuma remoção do Python foi realizada nesta etapa.

## Consulta de CNPJ no Nest (homologacao)

Adicionado `CnpjLookupService` com consulta primaria em CNPJ.ws e fallback para BrasilAPI, tratamento de falhas e campos no formato da resposta historica `GET /api/integrations/cnpj`. O endpoint exige sessao e valida CNPJ duplicado dentro da empresa. Testes isolados cobrem timeout, fallback e retorno invalido.

O proxy continua utilizando Python por padrao. Para verificar o novo endpoint em ambiente de homologacao, configurar `HIPERSALES_NEST_CNPJ_LOOKUP=true` no processo Nest e reinicia-lo. **Nao ativar em producao sem conferir os retornos com CNPJs reais e a equivalencia integral dos provedores.** `HIPERSALES_NEST_CUSTOMER_WRITES` tambem permanece desativado. A escrita de clientes no Nest ainda nao consome o resultado remoto da consulta.

## Cadastro de clientes: enriquecimento no Nest

O novo `CustomerRegistrationService` combina a consulta externa com o `CustomersWriteService`, sem executar requisições HTTP dentro de transações SQLite. Dados informados pelo operador têm prioridade sobre o retorno dos provedores; informações ausentes são preenchidas com o resultado de CNPJ.ws/BrasilAPI e o retorno é mantido em `form_payload._lookup`. Se ambos os provedores estiverem fora do ar, o cadastro continua com os dados enviados; conflitos de CNPJ e campos obrigatórios continuam bloqueados.

A rota de consulta `HIPERSALES_NEST_CNPJ_LOOKUP` e as escritas `HIPERSALES_NEST_CUSTOMER_WRITES` continuam opt-in. Não habilitar em produção sem comparar resultados reais com Python e executar build/testes. Ainda existem diferenças em validação e modelos de integrações do legado a homologar.

```bash
npm ci
npm run build:api
npm run test:api
```

## Vinculos de representantes (NestJS)

Os endpoints `GET /api/admin/users/:id/customers`, `GET /api/admin/users/:id/companies`, `PATCH /api/admin/customer-assignments` e `PATCH /api/admin/company-assignments` estao implementados no `AssignmentsController` e `AssignmentsService`. Aplicam isolamento por empresa e validam o perfil seller antes de criar/remover relacionamentos. A alteracao usa transacao; insercoes sao idempotentes.

A opcao `HIPERSALES_NEST_ASSIGNMENTS=true` redireciona esses quatro endpoints ao Nest em homologacao. Sem essa variavel, o Python continua respondendo. Validar com `npm run build:api` e `npm run test:api` e comparar os resultados com o legado antes de habilitar em producao. Solicitacoes de cadastro e aprovacoes permanecem no Python.

## Solicitacoes de cadastro: fase de migracao

A consulta administrativa `GET /api/admin/requests` tem implementacao Nest com isolamento por `tenant_id`, JOIN com representantes e ordenacao decrescente. O endpoint exige o perfil admin. Por padrao, o proxy ainda usa a API Python; `HIPERSALES_NEST_REGISTRATION_READS=true` habilita a consulta Nest em ambiente de homologacao. Nao habilitar antes de build, testes e comparacao de resposta.

A criacao de solicitacoes (`POST /api/customer-requests`) e o processamento (`PATCH /api/admin/requests/:id`) permanecem no Python. Aprovacao envolve upsert de cliente, associacao do representante, templates de mensagem e gravacao de e-mail/WhatsApp na outbox; migrar apenas o status sem estas regras pode gerar perda de notificacoes e inconsistencias no cadastro.

Para validar: `npm ci && npm run build:api && npm run test:api`. Confirmar que o processo Python segue ativo.

## Envio de solicitacoes no Nest (fase experimental)

`RegistrationSubmissionService` prepara o envio de `POST /api/customer-requests` exclusivamente para homologacao: valida o perfil seller, os campos obrigatorios, consulta CNPJ fora da transacao, protege contra cliente duplicado e grava a solicitacao e a linha de notificacao `email_outbox` na mesma transacao SQLite.

A rota **permanece em Python por padrao**. Somente `HIPERSALES_NEST_REGISTRATION_SUBMISSIONS=true` direciona ao Nest, devendo ser usada exclusivamente numa base de testes. O corpo de e-mail da primeira versao Nest e resumido e **ainda nao reproduz o template HTML completo** do Python; o comportamento de indisponibilidade do provedor CNPJ tambem precisa de homologacao. Aprovacao e recusa continuam integralmente no legado.

Rodar `npm ci`, `npm run build:api` e `npm run test:api` antes de qualquer deploy. Nao remover os processos Python.

## Processamento de solicitacoes (Nest em homologacao)

Foi implementado `RegistrationReviewService` com `PATCH /api/admin/requests/:id`, validacao de status, edicao dos dados da solicitacao, transacao SQLite, criacao/atualizacao do cliente por CNPJ normalizado, associacao idempotente com o representante e escopo obrigatorio de empresa. Testes: `test/registration-review.spec.ts`.

**A rota segue atendida apenas pelo Python no proxy de producao.** O Nest ainda nao cria as notificacoes baseadas nos templates configuraveis de email e WhatsApp, que o legado gera na transicao para `aprovada`. Habilitar o Nest nesse ponto pode omitir notificacoes; somente fazer a migracao da rota quando os templates e a outbox estiverem homologados. A implementacao ainda precisa passar por compilacao e testes na infraestrutura do projeto.

## Fila de notificacoes na aprovacao (Nest)

Foi implementado `ApprovalNotificationsService`, integrado ao `RegistrationReviewService`, para inserir eventos `customer_status_email` e, se habilitado, `customer_status_whatsapp` na `email_outbox` na mesma transacao de aprovacao do cliente. Faz interpolacao de variaveis do template por empresa e evita notificacoes duplicadas quando a solicitacao ja estava aprovada. Se os templates necessarios nao estiverem disponiveis, a transacao falha (sem aprovar silenciosamente sem mensagens).

**Ainda NAO habilitar a rota PATCH /api/admin/requests/:id no Nest em producao.** O proxy continua encaminhando-a ao Python. A implementacao Nest ainda nao reproduz o `logo_email` do legado, os templates padrao completos nem a conversao de avisos HTML em todos os cenarios. Estes pontos precisam ser homologados em testes e comparacao de respostas reais antes do corte. Os testes automatizados incluem placeholders e deduplicacao de aviso.

## Homologacao integrada das aprovacoes

`test/registration-approval.integration.spec.ts` cobre o processamento completo de uma aprovacao com as implementacoes reais `RegistrationReviewService` e `ApprovalNotificationsService`, utilizando SQLite em memoria. Os cenarios incluem rollback se WhatsApp estiver ligado mas sem template, aprovacao subsequente com canal desabilitado, ausencia de duplicidade na outbox e enfileiramento simultaneo de email/WhatsApp. Esses testes nao executam os provedores externos e nao comprovam equivalencia dos templates padrao legados.

A rota `PATCH /api/admin/requests/:id` continua no Python ate passar por compilacao, testes do projeto e homologacao dos emails e identidade visual. Nao usar o teste automatizado como autorizacao de deploy.

## Pedidos/propostas: migracao de consulta

Implementado `ProposalsModule` com `GET /api/proposals` no NestJS. A listagem reproduz colunas principais de pedidos, dados do representante/cliente/empresa, itens e eventos do historico filtrados por status. Mantem isolamento por `tenant_id`; representantes so veem seus pedidos. Testes automatizados foram adicionados em `test/proposals.spec.ts`.

O proxy preserva o Python por padrao. Para testes controlados, `HIPERSALES_NEST_PROPOSAL_READS=true` redireciona somente a consulta de propostas ao Nest; PDFs, inclusao e atualizacao de pedidos permanecem no Python. Nao ativar antes de comparar as respostas reais e de executar `npm run build:api` e `npm run test:api`.

## Propostas: criacao transacional no Nest (teste controlado)

Foi implementado `ProposalCreationService` com a rota `POST /api/proposals`: validacao de vendedor, empresa e cliente do tenant, vinculos comerciais, produtos ativos, quantidade/preco, percentuais e desconto; criacao de pedido, itens e primeiro evento em uma transacao. A sequencia de pedidos segue o criterio legado (maior numero + 1 com piso de 10840), com serializacao pelo `BEGIN IMMEDIATE` do `DatabaseService`.

A rota permanece no Python por padrao. A variavel `HIPERSALES_NEST_PROPOSAL_WRITES=true` e **exclusiva de homologacao**: falta integrar o template HTML real `format_new_proposal_email` e `queue_outbox`, conferir todas as classificacoes de bonificacao e comparar campos do banco original antes do uso real. O Nest nesta fase ainda NAO enfileira o aviso de nova proposta, portanto ativar a variavel em producao geraria perda de notificacao. `test/proposal-creation.spec.ts` verifica criacao, numeracao, limites entre empresas, permissoes e rollback.

Prioridade imediata para concluir, em vez de abrir novas migracoes em paralelo: concluir paridade de e-mail e homologar essa rota; concluir as rotas de cadastro ja implementadas; entao migrar atualizacoes de proposta.
