declare const process: { env: { EXPO_PUBLIC_API_URL?: string } };

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!configuredApiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL não configurada. Defina a URL base da API no ambiente do app.');
}

export const API_URL = configuredApiUrl.replace(/\/+$/, '');
