export const LOCALES = ['en', 'am', 'or'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Named formats shared by the server config and tests.
 *
 * `format.dateTime(d, 'short')` throws MISSING_FORMAT unless the name is declared here, which is
 * how the ministry dashboard's "generated at" line lost its formatting — so the names live in one
 * place that both `getRequestConfig` and the test providers read.
 */
export const FORMATS = {
  dateTime: {
    short: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    date: { day: 'numeric', month: 'long', year: 'numeric' },
  },
} as const
