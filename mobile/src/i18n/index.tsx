import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLocales } from 'expo-localization';

import am from './am.json';
import en from './en.json';
import or from './or.json';
import { loadLanguage, saveLanguage } from '@/storage/preferences';

export type Language = 'en' | 'am' | 'or';
export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'am', label: 'አማርኛ' },
  { code: 'or', label: 'Afaan Oromoo' },
];

type Messages = typeof en;
const messages: Record<Language, Messages> = { en, am, or };

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Leaves<T> = T extends object ? { [K in keyof T]-?: Join<K, Leaves<T[K]>> | (T[K] extends string ? K : never) }[keyof T] : never;
export type MessageKey = Leaves<Messages>;

function lookup(obj: unknown, path: string): string | undefined {
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj) as
    | string
    | undefined;
}

export function translate(lang: Language, key: MessageKey, vars?: Record<string, string | number>): string {
  const raw = lookup(messages[lang], key) ?? lookup(messages.en, key) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : raw;
}

export function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'en';
  if (code === 'am') return 'am';
  if (code === 'om' || code === 'or') return 'or';
  return 'en';
}

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage);

  useEffect(() => {
    loadLanguage().then((saved) => {
      if (saved) setLanguageState(saved);
    });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    void saveLanguage(lang);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t: (key, vars) => translate(language, key, vars) }),
    [language, setLanguage],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
