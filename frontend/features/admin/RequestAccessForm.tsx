'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, Eye, EyeOff, Send } from 'lucide-react'
import { STAKEHOLDERS, type OrganizationEnquiry } from '@agriminds/api-types'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/utils'

/**
 * The only form in the platform anybody can submit without signing in.
 *
 * It asks for the least that still makes a usable lead: who you are, what you are, and one way to
 * reply. The segment is offered as a choice because it shapes the conversation, but it is recorded
 * as the enquirer's own description — an administrator decides the actual segment on approval,
 * since the price follows from it.
 *
 * The acknowledgement is identical whether or not the organisation is already a customer. A form
 * that said "you already have an account" would let anyone test names against the customer list.
 */
/** Matches the server's configured minimum; the server is still the one that decides. */
const MIN_LENGTH = 10

export function RequestAccessForm() {
  const t = useTranslations('requestAccess')
  const ts = useTranslations('organizations.stakeholder')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    organization_name: '',
    contact_name: '',
    stakeholder: 'cooperative',
    contact_email: '',
    contact_phone: '',
    password: '',
    confirm: '',
    message: '',
  })

  const [reveal, setReveal] = useState(false)
  // Checked here only to catch a typo before a submission is spent; the server decides.
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password
  const tooShort = form.password.length > 0 && form.password.length < MIN_LENGTH

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value })

  const field = (
    key: 'organization_name' | 'contact_name' | 'contact_email' | 'contact_phone',
    type = 'text',
    required = false,
  ) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-fg-muted">{t(`field.${key}`)}</span>
      <input
        type={type}
        required={required}
        value={form[key]}
        onChange={set(key)}
        className="rounded-lg border border-border bg-surface px-3 py-2"
      />
    </label>
  )

  if (sent) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Check className="size-8 text-status-ok" aria-hidden />
        <h1 className="font-display text-xl font-bold">{t('sentTitle')}</h1>
        <p className="text-sm leading-relaxed text-fg-muted">{t('sentBody')}</p>
        <Link href="/login" className="text-sm text-primary underline">
          {t('backToSignIn')}
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-5 px-4 py-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm leading-relaxed text-fg-muted">{t('intro')}</p>
      </header>

      <form
        aria-label={t('title')}
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          try {
            const payload: OrganizationEnquiry = {
              organization_name: form.organization_name,
              contact_name: form.contact_name,
              stakeholder: form.stakeholder as OrganizationEnquiry['stakeholder'],
              contact_email: form.contact_email || null,
              contact_phone: form.contact_phone || null,
              password: form.password,
              message: form.message || null,
            }
            await api.enquire(payload)
            setSent(true)
          } catch (err) {
            setError((err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {field('organization_name', 'text', true)}
        {field('contact_name', 'text', true)}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">{t('field.stakeholder')}</span>
          <select
            value={form.stakeholder}
            onChange={set('stakeholder')}
            className="rounded-lg border border-border bg-surface px-3 py-2"
          >
            {STAKEHOLDERS.filter((s) => s !== 'farmer_premium').map((key) => (
              <option key={key} value={key}>
                {ts(key)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          {field('contact_email', 'email')}
          {field('contact_phone', 'tel')}
        </div>

        {/* Chosen here, so approval is the only thing standing between them and signing in. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{t('field.password')}</span>
            <div className="relative">
              <input
                type={reveal ? 'text' : 'password'}
                required
                minLength={MIN_LENGTH}
                value={form.password}
                onChange={set('password')}
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-11"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-pressed={reveal}
                aria-label={reveal ? t('hidePassword') : t('showPassword')}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-fg-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{t('field.confirm')}</span>
            <input
              type={reveal ? 'text' : 'password'}
              required
              value={form.confirm}
              onChange={set('confirm')}
              autoComplete="new-password"
              aria-invalid={mismatch}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            />
          </label>
          <p className={cn('text-xs sm:col-span-2', tooShort ? 'text-status-bad' : 'text-fg-subtle')}>
            {t('passwordHint', { count: MIN_LENGTH })}
          </p>
          {mismatch && (
            <p role="alert" className="text-xs text-status-bad sm:col-span-2">
              {t('mismatch')}
            </p>
          )}
        </div>
        {/* One reply route is required; a lead nobody can answer is not a lead. */}
        <p className="text-xs text-fg-subtle">{t('reachable')}</p>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">{t('field.message')}</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={form.message}
            onChange={set('message')}
            placeholder={t('messagePlaceholder')}
            className="rounded-lg border border-border bg-surface px-3 py-2"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-status-bad">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy || mismatch || tooShort}>
          <Send className="size-4" aria-hidden />
          {busy ? t('sending') : t('send')}
        </Button>
      </form>

      <p className="text-center text-sm text-fg-muted">
        <Link href="/login" className="text-primary underline">
          {t('haveAccount')}
        </Link>
      </p>
    </main>
  )
}
