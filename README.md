# Hipersales

Emissor de pedidos/propostas online com backend em Python, frontend HTML/JS e PWA para uso mobile.

## Como rodar

```powershell
cd c:\hypersales
venv\Scripts\python.exe backend\app.py
```

Acesse:

```text
http://localhost:8000
```

## Acessos de teste

Administrador:

```text
thalles
admin123
```

Representante comercial:

```text
vendedor
vendedor123
```

## O que ja esta implementado

- Login com sessao por cookie.
- Perfis de administrador e representante comercial.
- Menu lateral com clientes, propostas, pedidos e sair.
- Solicitação de cadastro de cliente pelo representante comercial.
- Consulta de clientes, respeitando associação representante comercial x cliente.
- Envio de proposta com empresa, cliente, condições comerciais e itens.
- Consulta de propostas/pedidos pelo representante comercial.
- Painel administrador para cadastrar cliente, associar cliente a representante comercial e atualizar status da proposta.
- PWA com manifest, service worker e icone instalavel.
- Banco SQLite local em `database/hypersales.sqlite3`.

## Observacao sobre e-mail

Nesta primeira versao, os e-mails que seriam enviados para `vendas@hipermixrepresentacoes.com.br` e para o representante ficam registrados na tabela `email_outbox`. O envio SMTP real pode ser ligado na proxima etapa usando variaveis de ambiente.
