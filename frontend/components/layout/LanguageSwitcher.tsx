'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { setLocale } from '@/app/actions/locale'
import { LOCALES, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

const LABEL: Record<Locale, string> = { en: 'EN', am: 'አማ', or: 'OM' }

export function LanguageSwitcher() {
  const locale = useLocale() as Locale
  const t = useTranslations('app')
  const [pending, startTransition] = useTransition()
  return (
    <div
      role="group"
      aria-label={t('language')}
      aria-busy={pending}
      className={cn('flex h-9 items-center gap-0.5 rounded-lg border border-border bg-surface-raised p-0.5 shadow-xs', pending && 'opacity-60')}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          disabled={pending}
          onClick={() => startTransition(() => setLocale(l))}
          className={cn(
            'h-full min-w-9 rounded-md px-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            locale === l ? 'bg-fg text-surface' : 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
          )}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  )
}
