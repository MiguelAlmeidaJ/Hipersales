# Frontend HiperSales

O frontend usa HTML, CSS e modulos JavaScript nativos do navegador. Nao ha
framework, bundler ou etapa obrigatoria de compilacao.

## Entradas publicas

- `index.html`: documento principal e referencias versionadas.
- `app.js`: entrada minima que inicializa os modulos.
- `styles.css`: entrada ordenada das folhas de estilo.
- `sw.js`: cache e funcionamento PWA.

## JavaScript

Os arquivos ficam em `modules/`:

- `core/state.js`: estado compartilhado, cache e paginacao.
- `core/ui.js`: formatadores, icones e componentes HTML reutilizaveis.
- `core/api.js`: cliente HTTP, carregamento de dados e navegacao.
- `core/shell.js`: layouts, login e selecao da tela ativa.
- `features/`: dashboards, clientes, ocorrencias, propostas e catalogo.
- `admin/`: pedidos, modais, cadastros e configuracoes administrativas.

Cada arquivo declara explicitamente seus `imports` e `exports`. Para novas
funcionalidades, mantenha a regra no modulo do dominio correspondente e evite
adicionar comportamento ao `app.js`.

## CSS

As folhas em `styles/` sao carregadas por `styles.css` em ordem de cascata. A
numeracao dos arquivos documenta essa ordem; nao deve ser alterada sem revisar
visualmente todas as telas e os breakpoints responsivos.

## Deploy

Publique toda a pasta `frontend`, incluindo `modules/` e `styles/`. O service
worker lista esses arquivos para manter o PWA disponivel depois do primeiro
carregamento.
