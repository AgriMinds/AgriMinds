'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Clock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMyPremiumRequest, useRequestPremium } from '@/features/farmer/useFarmer'

/**
 * How a farmer asks to leave the free tier.
 *
 * The platform priced a premium farmer tier and gave the farmer no way to buy it. This is that
 * way, and it is deliberately a *request* rather than a checkout: there is no payment gateway, and
 * a button that said "Pay" and then did nothing would be worse than no button.
 *
 * The price is shown with the argument that justifies it, because ETB 465 means nothing on its own
 * and a great deal next to the loss it is meant to prevent. That pairing is the whole of the
 * business model's farmer strategy — prove the economic value, then ask.
 *
 * Once asked, the card shows the state of the request instead of the offer. Asking twice is
 * refused by the API, so offering the button again would be inviting an error.
 */
export function PremiumCard() {
  const t = useTranslations('farm.premium')
  const existing = useMyPremiumRequest()
  const ask = useRequestPremium()
  const [note, setNote] = useState('')

  const request = existing.data
  const pending = request?.status === 'new' || request?.status === 'contacted'
  const approved = request?.status === 'approved'

  if (existing.isPending) return null

  if (approved) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-status-ok/40 bg-status-ok/5 p-3.5">
        <Check className="size-4 shrink-0 text-status-ok" aria-hidden />
        <p className="text-sm font-medium">{t('approved')}</p>
      </div>
    )
  }

  if (pending) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-sunken/60 p-3.5">
        <Clock className="size-4 shrink-0 text-fg-muted" aria-hidden />
        <p className="text-sm text-fg-muted">{t('pending')}</p>
      </div>
    )
  }

  return (
    <section
      aria-labelledby="premium-heading"
      className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4"
    >
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id="premium-heading" className="text-sm font-semibold">
            {t('title')}
          </h3>
          {/* The price next to what it prevents. On its own the number persuades nobody. */}
          <p className="text-sm leading-relaxed text-fg-muted">{t('value')}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-1 text-xs text-fg-muted">
        {(['sms', 'plots', 'season'] as const).map((item) => (
          <li key={item} className="flex items-start gap-1.5">
            <Check className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
            {t(`includes.${item}`)}
          </li>
        ))}
      </ul>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          ask.mutate({ message: note || null })
        }}
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-fg-muted">{t('noteLabel')}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={t('notePlaceholder')}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm"
          />
        </label>
        {ask.isError && (
          <p role="alert" className="text-xs text-status-bad">
            {(ask.error as Error).message}
          </p>
        )}
        <Button type="submit" disabled={ask.isPending} className="self-start">
          {ask.isPending ? t('asking') : t('ask')}
        </Button>
        <p className="text-[11px] text-fg-subtle">{t('noPayment')}</p>
      </form>
    </section>
  )
}
