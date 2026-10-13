'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle2, Eye, EyeOff, Loader2, TriangleAlert, UserPlus } from 'lucide-react'
import type { SignupRequest } from '@agriminds/api-types'
import { Button } from '@/components/ui/button'
import { ApiError, api } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const FIELD =
  'h-12 w-full rounded-xl border border-border bg-surface-raised px-3.5 text-base text-fg shadow-xs transition-colors placeholder:text-fg-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/** Matches the server's configured minimum; the server still decides. */
const MIN_LENGTH = 10

/**
 * How a smallholder opens an account without knowing anybody.
 *
 * A phone number, not an email: that is what a farmer here has, and it is what a development agent
 * will ring to confirm the holding. The note field is the only evidence an agent has to check
 * against what they know of the kebele, so it is asked for plainly rather than buried as optional
 * detail.
 *
 * Success is a waiting state, not a session. Saying "account created" and then refusing the next
 * sign-in would read as a broken form.
 */
export function SignupForm() {
  const t = useTranslations('signup')
  const locale = useLocale()
  const [form, setForm] = useState({ full_name: '', phone: '', password: '', note: '' })
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const tooShort = form.password.length > 0 && form.password.length < MIN_LENGTH

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const body: SignupRequest = {
        full_name: form.full_name,
        phone: form.phone,
        password: form.password,
        locale: locale as SignupRequest['locale'],
        note: form.note || null,
      }
      const accepted = await api.signup(body)
      setDone(accepted.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-status-ok/10 text-status-ok">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h2 className="font-display text-lg font-semibold">{t('sentTitle')}</h2>
        <p className="text-sm leading-relaxed text-fg-muted">{done}</p>
        <p className="text-xs text-fg-subtle">{t('sentHint')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="full_name" className="text-sm font-semibold">
          {t('name')}
        </label>
        <input
          id="full_name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className={FIELD}
          autoComplete="name"
          required
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-semibold">
          {t('phone')}
        </label>
        <input
          id="phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className={FIELD}
          placeholder="0912345678"
          inputMode="tel"
          autoComplete="tel"
          required
          disabled={submitting}
          aria-describedby="phone-hint"
        />
        <p id="phone-hint" className="text-xs text-fg-subtle">
          {t('phoneHint')}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold">
          {t('password')}
        </label>
        <div className="relative">
          <input
            id="password"
            type={reveal ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={cn(FIELD, 'pr-12')}
            autoComplete="new-password"
            required
            disabled={submitting}
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
        <p className={cn('text-xs', tooShort ? 'text-status-bad' : 'text-fg-subtle')}>
          {t('passwordHint', { count: MIN_LENGTH })}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-semibold">
          {t('note')}
        </label>
        <textarea
          id="note"
          rows={3}
          maxLength={2000}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder={t('notePlaceholder')}
          disabled={submitting}
          className="w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-base focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        {/* Said before they submit, not after they try to sign in and cannot. */}
        <p className="text-xs text-fg-subtle">{t('noteHint')}</p>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-status-bad/40 bg-status-bad/10 px-3.5 py-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-bad" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full text-base font-semibold"
        disabled={submitting || tooShort}
      >
        {submitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
        {submitting ? t('sending') : t('submit')}
      </Button>
    </form>
  )
}
