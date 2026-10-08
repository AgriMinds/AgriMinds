import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, FORMATS, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/config'

/**
 * Locale is selected with a cookie (no locale routing): the dashboard is a single internal page and
 * extension agents switch language in place. Falls back to English.
 */
export async function resolveLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale()
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: 'Africa/Addis_Ababa',
    formats: FORMATS,
  }
})
