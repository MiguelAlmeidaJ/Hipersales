# Prontidão para App Store e Google Play

Revisado em 14/10/2026. Este documento é operacional, não substitui revisão jurídica nem as validações dos consoles no dia da submissão.

## Estado técnico

- [x] Identificadores fixos: `br.com.hipermix.hipersales` em Android e iOS.
- [x] Expo SDK 57, que compila e aponta para Android API 36.
- [x] Versões nativas iniciais (`versionCode: 1` e `buildNumber: 1`).
- [x] Produção em Android App Bundle (`.aab`) via EAS.
- [x] Sessão nativa em Keychain/Android Keystore com token restrito ao aparelho.
- [x] API de produção bloqueada se não usar HTTPS.
- [x] Permissões de câmera, microfone, localização, contatos e mídia bloqueadas enquanto não houver funcionalidade que as justifique.
- [x] Declaração de criptografia iOS configurada para criptografia padrão/isenta.
- [x] Link de suporte disponível dentro do perfil.
- [x] Formulários de proposta e cliente respeitam o perfil autenticado e validam os dados antes da transmissão.
- [ ] Publicar política de privacidade e configurar `EXPO_PUBLIC_PRIVACY_URL`.
- [ ] Confirmar razão social, CNPJ, controlador dos dados e contato do encarregado.
- [ ] Criar contas Apple Developer e Google Play Console da pessoa jurídica.
- [ ] Definir conta de demonstração estável para as equipes de revisão.
- [ ] Gerar screenshots reais da versão candidata, sem dados de clientes reais.
- [ ] Executar testes em aparelho Android e iPhone físicos.

## Apple App Store

- Política de privacidade pública no App Store Connect e acessível dentro do app.
- Responder o questionário App Privacy conforme `PRIVACY-DATA-MAP.md`, incluindo SDKs de terceiros.
- Informar credenciais e instruções completas em App Review Information, pois todo o conteúdo exige login.
- Explicar que não há criação de conta no app: usuários são provisionados por administradores da HiperMix.
- Se criação de conta for adicionada futuramente, implementar início da exclusão dentro do app antes de submeter.
- Preencher categoria `Business`, classificação etária e informações de contato.
- Conferir no build final o relatório `PrivacyInfo.xcprivacy` agregado pelos módulos nativos.

## Google Play

- Completar Data safety mesmo que uma versão não colete dados opcionais.
- Informar a política de privacidade pública e coerente com o formulário.
- Declarar que dados de conta, clientes, contatos e propostas são transmitidos para funcionalidade do app, vinculados ao usuário e não usados para rastreamento/anúncios, após confirmação jurídica/técnica.
- Informar acesso restrito e fornecer conta de demonstração em App access.
- Publicar `.aab`, não APK, no track de produção. O perfil `preview` gera APK apenas para testes internos.
- Confirmar público-alvo adulto/profissional e ausência de publicidade.
- Se criação de conta for adicionada futuramente, oferecer exclusão dentro do app e por URL pública.

## Bloqueadores obrigatórios antes da primeira submissão

1. Publicar a política de privacidade em HTTPS.
2. Definir no EAS `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_PRIVACY_URL` e `EXPO_PUBLIC_SUPPORT_URL`.
3. Validar a política e o mapa de dados com o responsável jurídico/LGPD.
4. Remover dados reais das capturas e preparar credenciais exclusivas de revisão.
5. Rodar `pnpm --filter @hipersales/mobile validate:release` e o checklist de `RELEASE.md`.

## Fontes oficiais

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Apple Account Deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Expo SDK compatibility: https://docs.expo.dev/versions/latest/
- Expo permissions: https://docs.expo.dev/guides/permissions/
- Expo iOS privacy manifests: https://docs.expo.dev/guides/apple-privacy/
