import { Platform } from 'react-native';

import { loadApiBaseUrl, loadApiKey } from '@/storage/preferences';

export const RAILWAY_API_URL = 'https://backend-production-ced6.up.railway.app/api/v1';
export const LOCAL_LAN_API_URL = 'http://192.168.220.98:8001/api/v1';
export const EMULATOR_API_URL = 'http://10.0.2.2:8001/api/v1';

/**
 * Default API base URL:
 *  - EXPO_PUBLIC_API_URL when set (e.g. from EAS build or local .env)
 *  - Defaults to live Railway cloud backend so mobile devices connect seamlessly out-of-the-box.
 */
export function defaultApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv && !fromEnv.includes('YOUR-BACKEND')) return fromEnv.replace(/\/+$/, '');
  return RAILWAY_API_URL;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string | null;
}

let cached: ApiConfig | null = null;

export async function getApiConfig(): Promise<ApiConfig> {
  if (cached) return cached;
  const [url, key] = await Promise.all([loadApiBaseUrl(), loadApiKey()]);
  cached = {
    baseUrl: url || defaultApiBaseUrl(),
    apiKey: key || process.env.EXPO_PUBLIC_API_KEY?.trim() || null,
  };
  return cached;
}

export function resetApiConfigCache(): void {
  cached = null;
}
