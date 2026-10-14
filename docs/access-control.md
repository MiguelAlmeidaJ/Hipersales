# Controle de acesso do HiperSales

O HiperSales é um sistema interno single-tenant. Existe somente a organização `HiperMix`; `tenant_id` permanece no banco como chave de integridade e compatibilidade histórica, não como recurso de produto.

## Perfis

| Perfil | Acesso comercial | Administração | Gerenciar usuários dev | Visualizar usuários dev |
|---|---:|---:|---:|---:|
| `dev` | Sim | Sim | Sim | Sim |
| `admin` | Sim | Sim | Não | Não |
| `seller` | Somente carteira atribuída | Não | Não | Não |

O campo `users.role` é a única fonte de autorização (inclusive no mapper de sessão). Os campos legados `is_dev` e `is_super_admin` são mantidos temporariamente somente para compatibilidade da migration e não são enviados pelas APIs.

## Regras de proteção

- `dev` satisfaz rotas marcadas para `admin`; o inverso não ocorre.
- Listagens administrativas omitem desenvolvedores quando o ator é `admin`.
- Consulta ou alteração de um desenvolvedor por `admin` responde como usuário inexistente, evitando confirmar sua existência.
- Somente `dev` pode criar ou atribuir o perfil `dev`.
- Ninguém pode desativar a própria conta ou trocar o próprio perfil.
- Deve existir pelo menos um administrador ativo além dos desenvolvedores.
- A migration promove o usuário cujo nome ou login seja `Nivel3` para `dev`.

## Organização única

A migration `20261014110000_single_tenant_roles`:

- exige no máximo uma organização antes da conversão;
- cria ou normaliza a organização `HiperMix` (`slug=hipermix`);
- torna `users.tenant_id` obrigatório;
- limita os papéis a `dev`, `admin` e `seller`;
- instala uma proteção no banco contra inserção ou exclusão de tenants.
