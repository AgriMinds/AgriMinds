import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from './keys';

type Language = 'en' | 'am' | 'or';

async function getString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setString(key: string, value: string | null): Promise<void> {
  try {
    if (value === null || value === '') await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // storage is best-effort
  }
}

export async function loadLanguage(): Promise<Language | null> {
  const v = await getString(STORAGE_KEYS.language);
  return v === 'en' || v === 'am' || v === 'or' ? v : null;
}
export const saveLanguage = (lang: Language) => setString(STORAGE_KEYS.language, lang);

export const loadApiBaseUrl = () => getString(STORAGE_KEYS.apiBaseUrl);
export const saveApiBaseUrl = (url: string | null) => setString(STORAGE_KEYS.apiBaseUrl, url?.trim().replace(/\/+$/, '') ?? null);

export const loadApiKey = () => getString(STORAGE_KEYS.apiKey);
export const saveApiKey = (key: string | null) => setString(STORAGE_KEYS.apiKey, key?.trim() ?? null);

export async function clearQueryCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.queryCache);
  } catch {
    // ignore
  }
}
