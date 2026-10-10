'use client'

import { useState } from 'react'
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
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const busy = submitting

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await authApi.login(identifier, password)
      const target = safeNextPath(next) ?? homePathFor(user.role)
      window.location.assign(target)
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

      <div className="flex flex-col gap-1.5 pt-0.5">
        <span className="text-[10.5px] font-semibold tracking-wider text-fg-subtle uppercase">
          Demo Accounts (1-Tap Fill)
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setIdentifier('minister@moa.gov.et')
              setPassword('AgriMinds#2026')
              setError(null)
            }}
            className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-sunken p-2 text-center transition-colors hover:border-primary hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <span className="text-xs font-bold text-fg">Minister</span>
            <span className="text-[10px] text-primary">MoA</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setIdentifier('0912000001')
              setPassword('AgriMinds#2026')
              setError(null)
            }}
            className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-sunken p-2 text-center transition-colors hover:border-primary hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <span className="text-xs font-bold text-fg">Farmer</span>
            <span className="text-[10px] text-primary">Sinan Plot</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setIdentifier('agent.sinan@moa.gov.et')
              setPassword('AgriMinds#2026')
              setError(null)
            }}
            className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-sunken p-2 text-center transition-colors hover:border-primary hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <span className="text-xs font-bold text-fg">Agent</span>
            <span className="text-[10px] text-primary">Field DA</span>
          </button>
        </div>
      </div>

      <Button type="submit" size="lg" className="mt-1 h-12 w-full text-base font-semibold" disabled={busy}>
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
