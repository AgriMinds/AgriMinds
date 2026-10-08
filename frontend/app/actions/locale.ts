'use server'

import { cookies } from 'next/headers'
import { LOCALE_COOKIE, isLocale } from '@/i18n/config'

/** Sets the UI language. Mutating the cookie makes Next.js re-render the current route in the same roundtrip. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) throw new Error('Unsupported locale')
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  })
}
