# Processo de release mobile

## 1. Preparação

1. Atualize a versão semântica em `app.json`.
2. Confirme que a política pública corresponde a `PRIVACY-DATA-MAP.md`.
3. Configure no ambiente EAS:
   - `EXPO_PUBLIC_API_URL` com API HTTPS de produção;
   - `EXPO_PUBLIC_PRIVACY_URL` com política HTTPS publicada;
   - `EXPO_PUBLIC_SUPPORT_URL` com suporte HTTPS público.
4. Confirme que não há credenciais, `.env.local` ou dados reais versionados.

## 2. Qualidade

```bash
pnpm install --frozen-lockfile
pnpm build:contracts
pnpm --filter @hipersales/api typecheck
pnpm --filter @hipersales/mobile typecheck
pnpm --filter @hipersales/mobile exec expo-doctor
pnpm --filter @hipersales/mobile validate:release
```

Teste em aparelhos físicos:

- instalação limpa e atualização;
- login válido, inválido e sem internet;
- retomada após segundo plano e sessão expirada;
- troca obrigatória de senha;
- logout e reabertura;
- links de privacidade e suporte;
- busca, filtros e detalhes de pedidos, incluindo itens e histórico;
- busca e detalhes de clientes, incluindo abertura voluntária de telefone, WhatsApp e e-mail;
- telas pequenas, fonte ampliada e modo de acessibilidade.

## 3. Builds EAS

```bash
pnpm dlx eas-cli build --platform android --profile preview
pnpm dlx eas-cli build --platform all --profile production
```

O perfil de produção incrementa os números nativos remotamente. O script `eas-build-pre-install` bloqueia produção se URLs obrigatórias estiverem ausentes ou não forem HTTPS.

## 4. Submissão

```bash
pnpm dlx eas-cli submit --platform android --profile production
pnpm dlx eas-cli submit --platform ios --profile production
```

Prefira primeiro TestFlight e Google Play Internal testing. Só promova o mesmo artefato após validação e preenchimento dos questionários de privacidade, acesso do revisor e classificação de conteúdo.

## 5. Evidências da versão

Registre em cada release:

- commit/tag;
- números de build Android/iOS;
- resultado dos testes;
- mapa de dados revisado;
- screenshots usados;
- aprovador técnico e jurídico;
- data de publicação e plano de rollback.
