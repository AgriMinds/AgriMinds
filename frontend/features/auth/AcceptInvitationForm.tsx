'use client'

import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { homePathFor } from '@agriminds/api-types'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { ApiError, authApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const FIELD =
  'h-12 w-full rounded-xl border border-border bg-surface-raised px-3.5 text-base text-fg shadow-xs transition-colors placeholder:text-fg-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/** Matches the server's configured minimum; the server is still the one that decides. */
const MIN_LENGTH = 10

export function AcceptInvitationForm({ token }: { token: string }) {
  const t = useTranslations('auth')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Checked here only to catch a typo before spending a submission; the policy lives server-side.
  const mismatch = confirm.length > 0 && confirm !== password
  const tooShort = password.length > 0 && password.length < MIN_LENGTH

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await authApi.acceptInvitation(token, password)
      // Straight in: accepting the invitation already proved who they are.
      window.location.assign(homePathFor(user.role))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('genericError'))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold">
          {t('invite.passwordLabel')}
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={reveal ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(FIELD, 'pr-12')}
            autoComplete="new-password"
            required
            disabled={submitting}
            aria-describedby="password-hint"
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
        <p id="password-hint" className={cn('text-xs', tooShort ? 'text-status-bad' : 'text-fg-subtle')}>
          {t('invite.passwordHint', { count: MIN_LENGTH })}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm font-semibold">
          {t('invite.confirmLabel')}
        </label>
        <input
          id="confirm"
          name="confirm"
          type={reveal ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={FIELD}
          autoComplete="new-password"
          required
          disabled={submitting}
          aria-invalid={mismatch}
        />
        {mismatch && (
          <p role="alert" className="text-xs text-status-bad">
            {t('invite.mismatch')}
          </p>
        )}
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

      <Button
        type="submit"
        size="lg"
        className="mt-1 h-12 w-full text-base font-semibold"
        disabled={submitting || mismatch || tooShort || password.length === 0}
      >
        {submitting ? <Loader2 className="animate-spin" /> : <KeyRound />}
        {submitting ? t('invite.submitting') : t('invite.submit')}
      </Button>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-fg-subtle">{t('languageLabel')}</span>
        <LanguageSwitcher />
      </div>
    </form>
  )
}
