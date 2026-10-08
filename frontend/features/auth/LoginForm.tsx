'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, LogIn, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { homePathFor } from '@agriminds/api-types'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { ApiError, authApi } from '@/lib/api/client'
import { safeNextPath } from '@/lib/auth/routing'
import { cn } from '@/lib/utils'

const FIELD =
  'h-12 w-full rounded-xl border border-border bg-surface-raised px-3.5 text-base text-fg shadow-xs transition-colors placeholder:text-fg-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [routing, startRouting] = useTransition()
  const busy = submitting || routing

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await authApi.login(identifier, password)
      const target = safeNextPath(next) ?? homePathFor(user.role)
      startRouting(() => {
        router.replace(target)
        router.refresh()
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('genericError'))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="identifier" className="text-sm font-semibold">
          {t('identifierLabel')}
        </label>
        <input
          id="identifier"
          name="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className={FIELD}
          placeholder={t('identifierPlaceholder')}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          disabled={busy}
          aria-describedby="identifier-hint"
        />
        <p id="identifier-hint" className="text-xs text-fg-subtle">
          {t('identifierHint')}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold">
          {t('passwordLabel')}
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={reveal ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(FIELD, 'pr-12')}
            autoComplete="current-password"
            required
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
            aria-label={reveal ? t('hidePassword') : t('showPassword')}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-fg-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {reveal ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-status-bad/40 bg-status-bad/10 px-3.5 py-3 text-sm text-fg"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-bad" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <Button type="submit" size="lg" className="mt-1 h-12 w-full text-base" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
        {busy ? t('signingIn') : t('signIn')}
      </Button>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-fg-subtle">{t('languageLabel')}</span>
        <LanguageSwitcher />
      </div>
    </form>
  )
}
