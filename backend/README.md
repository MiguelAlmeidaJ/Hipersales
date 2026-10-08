# Backend HiperSales

O backend continua usando a biblioteca HTTP nativa do Python e SQLite. A
refatoracao separa responsabilidades sem alterar rotas, regras de negocio,
schema, formato de respostas ou o comando de inicializacao.

## Ponto de entrada

Execute como antes:

```bash
python backend/app.py
```

O arquivo `app.py` agora apenas compoe o handler HTTP, inicia os agendadores e
abre o servidor. Ele deve permanecer pequeno.

## Modulos

- `foundation.py`: configuracao, banco de dados, autenticacao, settings e
  integracoes compartilhadas.
- `documents.py`: formatacao de dados, mensagens, pedidos e documentos PDF.
- `shared.py`: superficie de compatibilidade usada pelos modulos de dominio.
- `http_handler.py`: transporte HTTP, sessao e roteamento da API.
- `tenant_goals.py`: superadministracao, dashboard e metas.
- `sales.py`: clientes, empresas, produtos, propostas e ocorrencias.
- `admin_dashboard.py`: visao administrativa, configuracoes e WhatsApp.
- `catalog_admin.py`: catalogo, vinculos e usuarios.
- `order_admin.py`: cadastros, pedidos, clientes e consulta de CNPJ.
- `report_data.py`: consultas e consolidacao de dados de relatorios.
- `report_pdf.py`: renderizacao dos relatorios em PDF.
- `background_jobs.py`: relatorios recorrentes, lembretes e rotinas legadas.

## Regra para novas alteracoes

Adicione cada regra ao modulo do seu dominio. O `HypersalesHandler`, em
`app.py`, combina os mixins e preserva a mesma interface usada pelo servidor.
Funcoes compartilhadas de infraestrutura ficam em `foundation.py`; funcoes de
documentos ficam em `documents.py`.

Imports relativos suportam o uso como pacote (`import backend.app`) e os
fallbacks absolutos preservam a execucao direta em producao.
