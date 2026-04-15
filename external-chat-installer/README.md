# Chat Desktop App

Base Electron para empacotar o chat externo como aplicativo Windows portatil.

## O que esta pronto

- UI de chat com branding do `chat_app`
- bootstrap por `bindingCode`
- historico por instalacao
- referencia de mensagens com acoes rapidas
- uso das rotas `/api/external-chat/*`

## Como usar

1. Ajuste `chat-app.config.json`
2. Instale dependencias:
   - `npm.cmd install`
3. Rodar local:
   - `npm.cmd run start`
4. Gerar aplicativo portatil:
   - `npm.cmd run dist`

## Sobre assinatura

Assinatura local ou self-signed nao elimina aviso do Windows SmartScreen.
Para distribuicao profissional sem alerta, voce precisa de certificado de code signing confiavel.
