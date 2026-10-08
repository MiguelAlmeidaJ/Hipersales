# Operacao Docker

1. Copie `.env.example` para `.env` e configure chaves/senhas.
2. Configure `HYPERSALES_PUBLIC_URL` com o dominio HTTPS de producao para o webhook da Evolution.
3. Rode `docker compose config` e `docker compose up -d --build`.
4. Acesse a aplicacao em :8000 e, se necessario, Evolution apenas via localhost:8081.
5. Teste cadastro, autenticacao, CRUD, propostas, relatorios, criacao de instancia WhatsApp, QR, envio e webhook.

**Dados existentes:** o Compose cria um volume SQLite novo. Se ja existe uma instalacao, realize backup consistente e restaure o SQLite no volume antes da ativacao. Nao use `docker compose down -v` em producao. Evolution mantem volumes proprios para banco e sessoes; o Baileys standalone anterior nao e migrado automaticamente (QR novo pode ser necessario).

O backend preserva agendadores que rodam no mesmo processo: nao escale replicas sem tratar exclusao mutua dos jobs.
