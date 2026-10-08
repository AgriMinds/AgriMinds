'use client'

import { useTransition } from 'react'
import { Globe } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { setLocale } from '@/app/actions/locale'
import { LOCALES, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

const LABEL: Record<Locale, string> = { en: 'EN', am: 'አማ', or: 'ORO' }

export function LanguageSwitcher() {
  const locale = useLocale() as Locale
  const t = useTranslations('app')
  const [pending, startTransition] = useTransition()
  return (
    <div
      role="group"
      aria-label={t('language')}
      aria-busy={pending}
      className={cn(
        'flex items-center gap-0.5 rounded-xl border border-border bg-surface-sunken p-0.5 sm:p-1',
        pending && 'opacity-60',
      )}
    >
      <Globe className="ml-1 hidden size-3.5 text-fg-subtle sm:block" aria-hidden />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          disabled={pending}
          onClick={() => startTransition(() => setLocale(l))}
          className={cn(
            'min-h-8 rounded-lg px-2 text-[11px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:text-xs',
            locale === l ? 'bg-surface-raised text-primary shadow-xs' : 'text-fg-muted hover:text-fg',
          )}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  )
}
