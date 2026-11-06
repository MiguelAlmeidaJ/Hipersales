# Publicação do HiperSales

## Estado técnico

- Identificadores: `br.com.hipersales` no Android e iOS.
- Android: AAB de produção, target/compile SDK 36, minificação e redução de recursos habilitadas.
- iOS: build incremental remoto e declaração de criptografia não isenta desabilitada.
- API, política de privacidade e suporte usam HTTPS.
- Tokens de sessão ficam no Secure Store; o app não contém segredo da API.
- Permissões de localização, contatos, áudio, armazenamento amplo e sobreposição de tela estão bloqueadas.

## Bloqueios antes do build final

- [ ] Confirmar que `https://api.hipersalesweb.com.br/api/v1/saude` aponta para o banco de produção. Em 06/11/2026 o endpoint respondeu com `banco: forcavendas_teste`.
- [ ] Configurar no ambiente `production` do EAS: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_SUPPORT_URL` e `EXPO_PUBLIC_USE_MOCK_API=false`.
- [ ] Disponibilizar uma conta de representante funcional para a revisão das lojas, com clientes, tabela, produtos, metas e ao menos um pedido de exemplo.
- [ ] Confirmar as credenciais de assinatura Android e o acesso Apple Developer/App Store Connect.

## Validação e build

```bash
pnpm check
pnpm validate:release
npx expo-doctor@latest
eas build --platform android --profile production
eas build --platform ios --profile production
```

Teste os binários em aparelhos físicos. No Android, publique primeiro em teste interno; no iOS, distribua primeiro pelo TestFlight.

## Cadastro nas lojas

- [ ] Nome, subtítulo/descrição, categoria e dados de contato.
- [ ] Ícone, screenshots de telefone e textos em português.
- [ ] URL pública da política de privacidade e URL de suporte.
- [ ] Questionários de privacidade coerentes com login, clientes, pedidos, anexos, câmera/fotos, notificações e identificadores do dispositivo usados no push.
- [ ] Instruções de revisão explicando que contas são criadas pelo escritório no sistema desktop; o app não oferece criação pública de conta.
- [ ] Credenciais de teste e passos para acessar os principais fluxos.
- [ ] Revisar classificação etária e disponibilidade por país.

## Envio

```bash
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

O envio sobe os binários; a liberação pública continua sendo concluída no Play Console e no App Store Connect.
