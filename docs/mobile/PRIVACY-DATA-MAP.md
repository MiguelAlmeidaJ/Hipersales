# Mapa preliminar de dados do HiperSales Mobile

Baseado na versão mobile 0.1.0 em 14/10/2026. Deve ser revisto sempre que uma tela, SDK ou integração for adicionada.

| Dado | Origem | Finalidade | Vinculado ao usuário | Compartilhado | Retenção no aparelho |
|---|---|---|---|---|---|
| Usuário/login | Digitado no login | Autenticação | Sim | Não identificado | Não retido |
| Senha | Digitada no login/troca | Autenticação e alteração | Sim | Não | Nunca persistida |
| Token de sessão | API HiperSales | Manter sessão autenticada | Sim | Não | Keychain/Keystore; removido no logout |
| Nome, e-mail, perfil e empresa | API HiperSales | Identificar usuário e autorizações | Sim | Não identificado | Apenas em memória durante a sessão |
| Indicadores comerciais | API HiperSales | Dashboard de trabalho | Associáveis à organização | Não identificado | Apenas em memória durante a sessão |
| Dados cadastrais de clientes e contatos (razão social, CNPJ, inscrição estadual, nome, telefone, e-mail, endereço e observações) | API e formulário de cliente | Consulta da carteira, cadastro ou solicitação de cadastro e contato comercial | Sim, ao contato/cliente | Não automaticamente | Apenas em memória durante a sessão; enviados ao servidor ao confirmar |
| Propostas, pedidos, produtos, preços, condições comerciais, itens, observações e histórico | API e formulário de proposta | Criação, consulta e acompanhamento comercial | Sim, ao usuário, cliente e organização | Não identificado | Apenas em memória durante a sessão; enviados ao servidor ao confirmar |

O usuário pode escolher abrir telefone, WhatsApp ou e-mail a partir de um cliente. O HiperSales apenas aciona o aplicativo externo por link do sistema; nenhum contato é enviado automaticamente sem a ação do usuário. O tratamento posterior passa a seguir as regras do aplicativo escolhido.

## Classificação preliminar para as lojas

- Finalidade: funcionalidade do app, gestão comercial e segurança/autenticação.
- Rastreamento: não.
- Publicidade: não.
- Venda de dados: não.
- Analytics/crash reporting de terceiros: não integrado nesta versão.
- Permissões sensíveis do aparelho: nenhuma solicitada nesta versão.
- Criptografia em trânsito: obrigatória em produção por HTTPS.
- Dados comerciais no servidor: seguem a política de retenção do HiperSales, ainda pendente de formalização jurídica.

## Decisões que precisam de confirmação

- Quem é o controlador e, se aplicável, operador dos dados conforme a LGPD.
- Prazo de retenção de sessões, usuários, clientes, pedidos e ocorrências.
- Processo e prazo para atender acesso, correção e exclusão.
- Terceiros que hospedam, processam backup, e-mail ou WhatsApp e seus papéis.
- Base legal aplicável a usuários internos, clientes e contatos comerciais.

## Regra de manutenção

Antes de instalar qualquer SDK (analytics, crash reporting, push, mapas, câmera ou marketing), atualizar esta tabela, revisar permissões, revisar os formulários das lojas e atualizar a política publicada.
