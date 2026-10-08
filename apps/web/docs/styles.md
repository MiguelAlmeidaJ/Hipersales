# Estilos Next.js

Tailwind CSS v4 controla os tokens e os estilos da aplicacao nova.
`app/globals.css` contem o import, tokens e aliases transitórios usando `@apply`.
Componentes novos devem utilizar utilitarios Tailwind diretamente. Nao usar
`apps/web/styles.css` (ele pertence apenas ao frontend antigo em transicao).

Inicie no diretorio `apps/web` com `npm install && npm run dev`.
O deploy nao deve apagar o frontend antigo antes do teste de paridade funcional.
