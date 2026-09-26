# IRON — Bloco 5 — Web Runtime

Status: CANDIDATE — runtime Web em certificação interna.

A Web comercial não é uma segunda aplicação: ela continua sendo o mesmo `iron-fit-app` Expo/React Native Web, exportado para `dist-web`.

## Build

- Node.js 22.
- `EXPO_PUBLIC_API_URL` é fornecida no build por ambiente.
- `npx expo export --platform web --output-dir dist-web`.
- `Dockerfile.web` empacota somente o export e o servidor estático mínimo.

## Runtime

- servidor Node built-in, sem nova autoridade de negócio;
- SPA fallback para `index.html`;
- `GET /health` para liveness/healthcheck da plataforma;
- headers básicos de proteção;
- assets servidos somente de `dist-web`.

## Ambiente

DEV/HOMOLOG/PROD usam o mesmo código e export. Variam apenas API URL, domínio, TLS e capacidade da plataforma.

Nenhuma URL pública de homologação/produção é declarada neste documento sem evidência física.
