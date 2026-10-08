import { Platform } from 'react-native';

import { loadApiBaseUrl, loadApiKey } from '@/storage/preferences';

/**
 * Default API base URL:
 *  - EXPO_PUBLIC_API_URL when set (physical devices: http://<HOST_IP>:8000/api/v1)
 *  - Android emulator loopback alias 10.0.2.2, iOS simulator / web localhost otherwise.
 */
export function defaultApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return Platform.select({
    android: 'http://10.0.2.2:8000/api/v1',
    default: 'http://localhost:8000/api/v1',
  });
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
