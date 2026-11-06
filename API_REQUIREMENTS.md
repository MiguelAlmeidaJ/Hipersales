# Contrato esperado pelo aplicativo HiperSales

Este documento lista as requisições que o aplicativo móvel/web espera da API externa. Ele foi consolidado a partir do cliente atual e do `MANUAL_API.pdf` definitivo.

## 1. Convenções gerais

- URL base esperada: `https://api.hipersalesweb.com.br/api/v1`.
- Todas as rotas, exceto `POST /auth/login` e `GET /saude`, exigem `Authorization: Bearer <accessToken>`.
- Requisições e respostas JSON usam `Content-Type: application/json; charset=utf-8`.
- PDFs usam `Content-Type: application/pdf` e, preferencialmente, `Content-Disposition: inline; filename="arquivo.pdf"`.
- Datas de negócio usam `DD/MM/AAAA`.
- Data e hora usam `DD/MM/AAAA hh:mm:ss`.
- Paginação usa `pagina` e `tamanho` e retorna `{ "total", "pagina", "tamanho", "itens" }`.
- O app solicita até `200` registros por página em cargas comerciais.
- Valores monetários e percentuais são números JSON, não strings formatadas.
- CNPJ pode ser alfanumérico nas 12 primeiras posições; não deve ser validado apenas como número.

Cabeçalhos que precisam ser aceitos pelo CORS no navegador:

```text
Authorization
Content-Type
Idempotency-Key
Accept
```

Métodos necessários no CORS: `GET`, `POST`, `PATCH`, `DELETE` e `OPTIONS`.

### Resposta de erro

Formato esperado:

```json
{
  "erro": {
    "codigo": "PEDIDO_MINIMO",
    "mensagem": "O pedido não atingiu o valor mínimo.",
    "campo": "itens"
  }
}
```

O campo `campo` é opcional. Status HTTP usados pelo app: `400`, `401`, `403`, `404`, `409`, `413`, `422`, `429` e `503`.

## 2. Resumo das rotas obrigatórias

| Método | Rota externa | Uso no aplicativo |
| --- | --- | --- |
| GET | `/saude` | Diagnóstico da API |
| POST | `/auth/login` | Autenticação |
| GET | `/clientes` | Carteira do representante |
| POST | `/clientes` | Solicitação de novo cliente |
| GET | `/clientes/atendidos/ids` | Sincronização dos códigos atuais da carteira |
| GET | `/tabelas-preco` | Tabelas liberadas ao representante |
| GET | `/tabelas-preco/{id}/pdf` | Compartilhar tabela oficial |
| GET | `/prazos` | Condições de pagamento |
| GET | `/produtos` | Produtos e preços da tabela |
| POST | `/pedidos` | Transmissão de pedido |
| GET | `/pedidos` | Lista de pedidos |
| GET | `/pedidos/{id}` | Detalhe do pedido |
| GET | `/pedidos/{id}/status` | Atualização rápida do status |
| GET | `/pedidos/{id}/pdf` | PDF do pedido de venda; rota preparada no app e pendente na API |
| GET | `/vendas` | Painel, atividades e totais do período |
| GET | `/notas-fiscais` | Lista de notas fiscais |
| GET | `/notas-fiscais/{idPedido}` | Detalhe da nota fiscal |
| GET | `/notas-fiscais/{idPedido}/pdf` | Compartilhar PDF da nota fiscal |
| GET | `/metas` | Metas do representante |
| GET | `/notifications` | Central de notificações |
| GET | `/notifications/unread-count` | Contador de não lidas |
| PATCH | `/notifications/{id}/read` | Marcar uma notificação como lida |
| POST | `/notifications/read-all` | Marcar todas como lidas |
| POST | `/mobile/push-token` | Registrar aparelho |
| DELETE | `/mobile/push-token` | Remover aparelho no logout |
| GET | `/occurrences/reasons` | Motivos de ocorrência |
| GET | `/occurrences` | Lista de ocorrências |
| POST | `/occurrences` | Abrir ocorrência |
| GET | `/occurrences/{id}` | Detalhe da ocorrência |
| GET | `/occurrences/{id}/attachments/{fileId}` | Baixar/compartilhar anexo |
| GET | `/occurrences/{id}/pdf` | Compartilhar PDF da ocorrência |
| PATCH | `/admin/occurrences/{id}` | Tratamento administrativo |
| GET | `/apoio/municipios` | Resolver o município no cadastro do cliente |

## 3. Autenticação e saúde

### `GET /saude`

Resposta mínima:

```json
{
  "status": "ok",
  "versao": "1.0.0",
  "banco": "forcavendas",
  "hora": "06/11/2026 10:47:40"
}
```

### `POST /auth/login`

```json
{
  "usuario": "vendedor",
  "senha": "senha"
}
```

Resposta:

```json
{
  "accessToken": "token-jwt-ou-opaco",
  "usuario": "vendedor",
  "admin": false,
  "representante": {
    "id": 12,
    "nome": "Marcos Almeida"
  }
}
```

`accessToken` e `usuario` são obrigatórios. Para vendedor, `representante.id` é necessário para metas, carteira e ocorrências.

## 4. Clientes

### `GET /clientes`

Parâmetros usados ou aceitos pelo app:

- `busca`: razão social, fantasia ou documento.
- `vinculadoApos`: sincronização incremental.
- `pagina` e `tamanho`.
- Administrador pode usar o escopo previsto pela API.

Resposta:

```json
{
  "total": 1,
  "pagina": 1,
  "tamanho": 200,
  "itens": [
    {
      "id": 575,
      "razaoSocial": "MERCADO TESTE API LTDA",
      "nomeFantasia": "Mercado Teste",
      "documento": "11.222.333/0001-81",
      "inscricaoEstadual": "123456789",
      "statusCadastro": "APROVADO",
      "motivoRejeicao": null,
      "vinculadoEm": "01/11/2026 08:00:00",
      "logradouro": "Rua Central",
      "numero": "100",
      "complemento": null,
      "bairro": "Centro",
      "cidade": "Juiz de Fora",
      "uf": "MG",
      "cep": "36000000",
      "telefoneCompras1": "32999999999",
      "telefoneCompras2": null,
      "emailCompras": "compras@cliente.com"
    }
  ]
}
```

Somente clientes com `statusCadastro: "APROVADO"` podem receber pedidos.

### `POST /clientes`

O app envia os campos preenchidos e omite campos vazios:

```json
{
  "razaoSocial": "MERCADO TESTE LTDA",
  "nomeFantasia": "Mercado Teste",
  "documento": "11.222.333/0001-81",
  "inscricaoEstadual": "123456789",
  "logradouro": "Rua Central",
  "numero": "100",
  "complemento": "Loja A",
  "bairro": "Centro",
  "cep": "36000000",
  "uf": "MG",
  "idMunicipio": 1234,
  "rede": "Rede Exemplo",
  "regimeFiscal": "Simples Nacional",
  "beneficioFiscal": "Descrição do benefício",
  "enderecoEntrega": "Rua de Entrega, 200, Centro, Juiz de Fora/MG, 36000000",
  "advertenciasRecebimento": "Entrega agendada: Sim\nAgendamento: ligar antes\nDias de recebimento: segunda a sexta\nHorário: 08:00 às 16:00",
  "respCompras": "Maria",
  "telefoneCompras1": "32999999999",
  "telefoneCompras2": "",
  "emailCompras": "compras@cliente.com",
  "respFinanceiro": "João",
  "telefoneFinanceiro1": "32988888888",
  "telefoneFinanceiro2": "",
  "emailFinanceiro": "financeiro@cliente.com",
  "respLogistica": "Ana",
  "telefoneLogistica1": "32977777777",
  "emailLogistica": "xml@cliente.com",
  "observacao": "Observações adicionais"
}
```

Resposta esperada:

```json
{
  "mensagem": "Cliente enviado para aprovação.",
  "cliente": {
    "id": 9001,
    "statusCadastro": "AGUARDANDO APROVACAO"
  }
}
```

Conflito de documento existente deve retornar `409`. O app então pode localizar o cliente pela busca.

### `GET /clientes/atendidos/ids`

Retorna todos os códigos da carteira atual, sem paginação. Serve para remover do aparelho os clientes que deixaram a carteira. Parâmetros opcionais: `status` e, somente para administrador, `idRepresentante`.

Resposta preferencial:

```json
{
  "total": 2,
  "geradoEm": "06/11/2026 10:00:00",
  "ids": [575, 576]
}
```

## 5. Apoio cadastral

### `GET /apoio/municipios?uf=MG&busca=Juiz%20de%20Fora&tamanho=50`

```json
{
  "total": 1,
  "pagina": 1,
  "tamanho": 50,
  "itens": [
    { "id": 1234, "descricao": "Juiz de Fora", "uf": "MG" }
  ]
}
```

Rotas já previstas pelo adaptador, mas não obrigatórias para o fluxo atual: `GET /apoio/ramos-atividade` e `GET /apoio/regioes-atendimento`.

Consulta de CNPJ em `GET /integrations/cnpj?cnpj=...` é opcional. Quando indisponível, o app consulta fontes públicas e permite preenchimento manual.

## 6. Tabelas, prazos e produtos

### `GET /tabelas-preco`

Deve retornar somente tabelas vigentes e liberadas ao representante autenticado.

```json
{
  "itens": [
    {
      "idTabela": 7,
      "idEmpresa": 2,
      "empresaNome": "HIPER-ROLL",
      "descricao": "DISTRIBUIDOR",
      "dataInicio": "06/04/2026",
      "dataFim": null,
      "pedidoMinimo": 10000,
      "frete": "CIF",
      "prazoEntregaDias": 30,
      "idCondPagto": 4,
      "condPagtoDescricao": "35 DIAS",
      "condPagtoDias": 35,
      "condicoesPagamento": [
        { "idCondPagto": 4, "descricao": "35 DIAS", "dias": 35 }
      ],
      "operadorFiscal": "SIM",
      "percComissao": 4,
      "percDesconto": 3,
      "descontoEm": "BOLETO BANCÁRIO",
      "situacao": "VIGENTE",
      "temPdf": true,
      "pdfGeradoEm": "29/10/2026 11:32:23"
    }
  ]
}
```

### `GET /tabelas-preco/{id}/pdf`

Retorna o PDF oficial com autenticação. Respostas importantes:

- `200 application/pdf`.
- `404 PDF_INDISPONIVEL` quando ainda não foi gerado.
- `404 NAO_ENCONTRADO` quando a tabela não pertence ao representante.
- `503 TABELA_PDF_INDISPONIVEL` quando o recurso não está instalado.

### `GET /prazos`

```json
{
  "itens": [
    { "idCondPagto": 4, "descricao": "35 DIAS", "dias": 35 }
  ]
}
```

Também é aceito um array direto.

### `GET /produtos`

Parâmetros usados: `idEmpresa`, `idTabela`, `busca`, `pagina` e `tamanho`.

```json
{
  "total": 1,
  "pagina": 1,
  "tamanho": 200,
  "itens": [
    {
      "idProduto": 381,
      "idEmpresa": 2,
      "idTabela": 7,
      "codigo": "SAC-3848",
      "descricao": "SACOLA REFORÇADA BRANCA 38X48",
      "unidade": "FD C/ 1000",
      "preco": 58.75,
      "precoComIpi": 62.57
    }
  ]
}
```

O campo `preco` deve ser o preço sugerido final que o representante pode usar em `valorUnitario`.

## 7. Pedidos e vendas

### `POST /pedidos`

Cabeçalho obrigatório:

```text
Idempotency-Key: app-<timestamp>-<aleatorio>
```

Corpo:

```json
{
  "idEmpresa": 2,
  "idCliente": 575,
  "idTabela": 7,
  "idCondPagto": 4,
  "tipoPedido": "Venda",
  "faturamentoPercentual": 100,
  "formatoEntrega": "Imediata",
  "numeroPedidoCliente": "OC-9081",
  "observacoes": "Entregar após as 8h.",
  "itens": [
    {
      "idProduto": 381,
      "quantidade": 5,
      "valorUnitario": 58.75
    }
  ]
}
```

Regras:

- `tipoPedido`: `Venda` ou `Bonificacao`.
- Bonificação não envia `idCondPagto`.
- `faturamentoPercentual`: `100`, `50`, `30`, `10` ou `0`.
- `formatoEntrega`: `Imediata` ou `Programada`.
- Programada envia `dataProgramada` em `DD/MM/AAAA`.
- `valorUnitario` deve ser validado contra a tabela.
- Reenvio com a mesma `Idempotency-Key` não pode criar outro pedido.

Resposta de criação (`201`) ou repetição (`200`):

```json
{
  "mensagem": "Pedido registrado com status EM ANÁLISE.",
  "repetido": false,
  "pedido": {
    "idPedido": 1003,
    "status": "EM ANÁLISE",
    "valorBruto": 293.75,
    "valorLiquido": 293.75,
    "validacaoPreco": "OK",
    "itens": []
  }
}
```

### `GET /pedidos`

Filtros utilizados/aceitos: `de`, `ate`, `status`, `idCliente`, `pagina` e `tamanho`.

Resposta paginada. Cada item deve trazer, no mínimo:

```json
{
  "idPedido": 1003,
  "dataPedido": "05/11/2026",
  "status": "EM ANÁLISE",
  "tipoPedido": "Venda",
  "idEmpresa": 2,
  "empresaNome": "HIPER-ROLL",
  "idCliente": 575,
  "clienteRazaoSocial": "MERCADO TESTE LTDA",
  "clienteNomeFantasia": "Mercado Teste",
  "clienteDocumento": "11.222.333/0001-81",
  "condPagtoDescricao": "35 DIAS",
  "frete": "CIF",
  "formatoEntrega": "Imediata",
  "entregaPrevista": "20/11/2026",
  "leadTimeDias": 15,
  "nroPedidoCliente": "OC-9081",
  "nroPedidoEmpresa": null,
  "nfNumero": null,
  "dtFaturamento": null,
  "dtEntrega": null,
  "observacoes": "Entregar após as 8h.",
  "descontoPercentual": 0,
  "valorBruto": 293.75,
  "valorLiquido": 293.75,
  "origem": "API",
  "itens": []
}
```

### `GET /pedidos/{id}`

Retorna o cabeçalho completo e `itens`:

```json
{
  "idPedido": 1003,
  "status": "EM ANÁLISE",
  "itens": [
    {
      "idItem": 11,
      "idProduto": 381,
      "codigo": "SAC-3848",
      "descricao": "SACOLA REFORÇADA BRANCA 38X48",
      "unidade": "FD C/ 1000",
      "quantidade": 5,
      "precoUnitario": 58.75,
      "total": 293.75
    }
  ]
}
```

### `GET /pedidos/{id}/status`

```json
{
  "idPedido": 1003,
  "status": "FATURADO",
  "dataPedido": "05/11/2026",
  "entregaPrevista": "20/11/2026",
  "nfNumero": "000123",
  "dtFaturamento": "10/11/2026",
  "dtEntrega": null
}
```

Status reconhecidos: `EM ANÁLISE`, `APROVADO`, `RECUSADO`, `CANCELADO`, `EM PRODUÇÃO`, `FATURADO`, `ENTREGUE` e `DEVOLVIDO`.

### `GET /pedidos/{id}/pdf` — contrato preparado, pendente no backend

O app já chama esta rota e compartilha o arquivo no Android, iOS e navegador.

Requisitos:

- `Authorization: Bearer` obrigatório.
- `200` com o corpo binário do PDF.
- `Content-Type: application/pdf`.
- `Content-Disposition: inline; filename="pedido-venda-1003.pdf"`.
- Representante só acessa pedidos do próprio escopo.
- `404 NAO_ENCONTRADO` para pedido inexistente ou sem acesso.
- `404 PDF_INDISPONIVEL` caso o pedido exista, mas o PDF ainda não esteja pronto.

### `GET /vendas?de=01/11/2026&ate=30/11/2026`

```json
{
  "resumo": {
    "qtdPedidos": 2,
    "valorTotal": 1466.05
  },
  "porStatus": [
    { "status": "FATURADO", "qtdPedidos": 1, "valorTotal": 1023.40 }
  ],
  "porEmpresa": [
    { "idEmpresa": 2, "empresaNome": "HIPER-ROLL", "qtdPedidos": 1, "valorTotal": 442.65 }
  ],
  "pedidos": []
}
```

`pedidos` é usado como fallback para calcular clientes atendidos.

## 8. Notas fiscais

### `GET /notas-fiscais`

Filtros: `de`, `ate`, `idCliente`, `numero`, `pagina` e `tamanho`.

### `GET /notas-fiscais/{idPedido}`

```json
{
  "idPedido": 13,
  "nfNumero": "000123",
  "dtFaturamento": "20/10/2026",
  "dtEntrega": "25/10/2026",
  "status": "FATURADO",
  "idEmpresa": 2,
  "empresaNome": "HIPER-ROLL",
  "idCliente": 575,
  "clienteRazaoSocial": "MERCADO TESTE API LTDA",
  "clienteDocumento": "11.222.333/0001-81",
  "valor": 9904.50,
  "temPdf": true
}
```

### `GET /notas-fiscais/{idPedido}/pdf`

Retorna `application/pdf`. Deve responder `404` quando o arquivo ainda não estiver anexado.

## 9. Metas

O app converte `year=2026&month=11` para:

```http
GET /metas?competencia=2026-11
```

Resposta:

```json
{
  "disponivel": true,
  "competencia": "2026-11",
  "revisao": 1,
  "enviadaEm": "01/11/2026 08:00:00",
  "metas": {
    "faturamento": {
      "ativo": true,
      "meta": 25000,
      "realizado": 1466.05,
      "falta": 23533.95,
      "percentual": 5.8642
    },
    "novosClientes": {
      "ativo": true,
      "meta": 5,
      "realizado": 1,
      "falta": 4,
      "percentual": 20
    },
    "positivacao": {
      "ativo": true,
      "meta": 18,
      "realizado": 2,
      "falta": 16,
      "percentual": 11.11
    }
  }
}
```

Quando não houver meta, retornar `200` com `disponivel: false`, e não `404`.

## 10. Notificações e push

### `GET /notifications`

Resposta paginada ou com `itens`:

```json
{
  "itens": [
    {
      "id": 10,
      "tipo": "PEDIDO_FATURADO",
      "titulo": "Pedido faturado",
      "mensagem": "O pedido 1002 foi faturado.",
      "criadaEm": "05/11/2026 09:00:00",
      "lida": false,
      "lidaEm": null,
      "idPedido": 1002,
      "idCliente": null,
      "idOcorrencia": null,
      "idMeta": null
    }
  ]
}
```

Os IDs relacionados direcionam o usuário para pedido, cliente, ocorrência ou meta.

### Demais rotas

```http
GET /notifications/unread-count
PATCH /notifications/{id}/read
POST /notifications/read-all
```

Contador aceito:

```json
{ "naoLidas": 3 }
```

O app também aceita `count`.

### `POST /mobile/push-token`

```json
{
  "token": "ExponentPushToken[...]",
  "platform": "android",
  "deviceName": "Galaxy S24"
}
```

### `DELETE /mobile/push-token`

```json
{
  "token": "ExponentPushToken[...]"
}
```

O `DELETE` ocorre antes de limpar a sessão no logout.

## 11. Ocorrências

### `GET /occurrences/reasons`

```json
{
  "itens": [
    { "id": 1, "reason": "Produto avariado" }
  ]
}
```

### `GET /occurrences`

Filtros aceitos: `status`, `reason_id`, `customer_id`, `order_id`, `de`, `ate`, `q`, `seller_id`, `pagina` e `tamanho`.

### `POST /occurrences`

```json
{
  "customer_id": 575,
  "reason_id": 1,
  "description": "As caixas chegaram amassadas.",
  "order_id": 1003,
  "company_id": 2,
  "attachments": [
    {
      "name": "foto.jpg",
      "mime": "image/jpeg",
      "data_base64": "/9j/4AAQ..."
    }
  ]
}
```

Administrador também pode enviar `seller_id` e `priority`.

Limites esperados: até 20 anexos e 25 MB no total. O prefixo `data:...;base64,` pode ser aceito, mas o app normalmente envia somente o base64.

### Formato de detalhe/lista

```json
{
  "id": 7,
  "customer_id": 575,
  "customer_name": "Mercado Teste",
  "customer_cnpj": "11.222.333/0001-81",
  "seller_id": 12,
  "seller_name": "Marcos Almeida",
  "reason_id": 1,
  "reason": "Produto avariado",
  "description": "As caixas chegaram amassadas.",
  "status": "em_analise",
  "resolution": "Conferência solicitada.",
  "priority": "media",
  "order_id": 1003,
  "company_id": 2,
  "company_name": "HIPER-ROLL",
  "created_at": "05/11/2026 09:15:00",
  "updated_at": "05/11/2026 10:05:00",
  "resolved_at": null,
  "due_at": null,
  "attachments": [
    {
      "id": 1,
      "name": "foto.jpg",
      "mime": "image/jpeg",
      "size": 12345,
      "url": "/api/v1/occurrences/7/attachments/1"
    }
  ],
  "timeline": [
    {
      "at": "05/11/2026 09:15:00",
      "action": "abertura",
      "status_from": null,
      "status_to": "aberta",
      "user": "vendedor",
      "origin": "app",
      "text": "Ocorrência aberta."
    }
  ]
}
```

### Arquivos

```http
GET /occurrences/{id}/attachments/{fileId}
GET /occurrences/{id}/pdf
```

Ambas exigem `Authorization`. O anexo preserva seu `Content-Type`; o PDF retorna `application/pdf`.

### `PATCH /admin/occurrences/{id}`

```json
{
  "status": "solucionada",
  "resolution": "Reposição enviada.",
  "priority": "alta",
  "responsible_user_id": 3,
  "due_at": "10/11/2026",
  "order_id": 1003,
  "company_id": 2
}
```

Valor `0` remove `responsible_user_id`, `order_id` ou `company_id`; string vazia remove `due_at`. Status `recusada` e `solucionada` exigem parecer.

## 12. Rotas fora do contrato obrigatório

O repositório ainda contém telas administrativas antigas, mas elas não aparecem nos módulos da versão definitiva e o adaptador externo recusa essas chamadas. A API atual não precisa implementar, para o lançamento móvel:

- CRUD de usuários.
- CRUD de empresas e produtos.
- Cadastro administrativo de metas.
- Configurações SMTP/WhatsApp.
- Funis e relatórios administrativos antigos.
- Vínculos administrativos de carteira.
- Alteração manual de pedidos pelo aplicativo.
- Upload de nota fiscal pelo aplicativo.
- Troca de senha pelo aplicativo, enquanto não houver contrato publicado.

Se essas funções voltarem ao escopo, os contratos devem ser definidos antes de reativar as telas.

## 13. Checklist de homologação

- [ ] Login de vendedor retorna token e representante.
- [ ] Token inválido retorna `401`.
- [ ] Carteira contém somente clientes permitidos.
- [ ] Cliente novo nasce aguardando aprovação.
- [ ] Tabelas e produtos respeitam a liberação do vendedor.
- [ ] Tabela não permitida retorna `422 TABELA_NAO_PERMITIDA`.
- [ ] Pedido duplicado com a mesma chave não é recriado.
- [ ] Pedido abaixo do mínimo retorna `422 PEDIDO_MINIMO`.
- [ ] Lista e detalhe de pedidos retornam itens e totais.
- [ ] PDF do pedido pode ser baixado com Bearer Token.
- [ ] PDF da tabela e da nota fiscal retornam `application/pdf`.
- [ ] Metas sem cadastro retornam `200` com `disponivel: false`.
- [ ] Push token pode ser registrado e removido.
- [ ] Notificações podem ser marcadas como lidas.
- [ ] Ocorrência aceita anexos dentro dos limites.
- [ ] Representante não acessa pedido, cliente, tabela ou ocorrência de outro representante.
- [ ] CORS permite a origem web e os cabeçalhos necessários.

