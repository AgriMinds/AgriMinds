'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Check, Clock, Copy, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChoosePlan, usePlans } from '@/features/billing/usePlans'
import { useMyPremiumRequest, useRequestPremium } from '@/features/farmer/useFarmer'

/**
 * How a farmer leaves the free tier: ask, get approved, pay, and have premium start.
 *
 * The platform priced a premium farmer tier and gave the farmer no way to buy it. This is that
 * way, and it starts as a *request* rather than a checkout: an officer confirms the holding before
 * a price is shown, and there is no gateway to take money through regardless.
 *
 * The price is shown with the argument that justifies it, because the figure means nothing on its
 * own and a great deal next to the loss it is meant to prevent. That pairing is the whole of the
 * business model's farmer strategy — prove the economic value, then ask.
 *
 * Once asked, the card shows the state of the request instead of the offer. Asking twice is
 * refused by the API, so offering the button again would be inviting an error.
 *
 * Approval used to be where this card stopped -- it said "approved" and offered nothing, so a
 * farmer who had been accepted could never actually buy the tier that was priced for them. From
 * approval on it now carries the rest of the journey: the price, the choice, the reference to pay
 * against, and finally the date premium runs until. The price comes from the rate card rather than
 * from this file, so repricing cannot leave a stale number in the copy.
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

  if (approved) return <PremiumPlan />

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

/**
 * Everything after approval, in one card: buy a year, pay it, see it running.
 *
 * It reuses the same plans endpoint and the same invoice machinery as an institution's billing
 * page. A farmer is a payer of a different size, not of a different kind, and a second
 * implementation for individuals would be a second place for the money to be wrong.
 */
function PremiumPlan() {
  const t = useTranslations('farm.premium')
  const format = useFormatter()
  const plans = usePlans()
  const choose = useChoosePlan()
  const [copied, setCopied] = useState(false)

  if (plans.isPending) return null
  if (plans.isError) {
    return (
      <div className="rounded-xl border border-border bg-surface-sunken/60 p-3.5">
        <p className="text-sm font-medium">{t('approved')}</p>
        <p className="mt-1 text-xs text-fg-muted">{(plans.error as Error).message}</p>
      </div>
    )
  }

  const data = plans.data
  const annual = data?.options.find((o) => o.period === 'annual') ?? data?.options[0]
  const current = data?.current ?? null
  // Issued at checkout and carried on the plans response, so closing the page does not lose it.
  const bill = choose.data?.invoice ?? data?.outstanding ?? null

  if (current?.status === 'active') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-status-ok/40 bg-status-ok/5 p-3.5">
        <Check className="mt-0.5 size-4 shrink-0 text-status-ok" aria-hidden />
        <p className="text-sm font-medium">
          {current.ends_on
            ? t('activeUntil', { date: format.dateTime(new Date(current.ends_on), 'date') })
            : t('active')}
        </p>
      </div>
    )
  }

  // Chosen but not settled: the only thing that matters now is the reference to quote.
  if (bill) {
    const payTo = data?.pay_to ?? ''
    return (
      <section
        aria-labelledby="premium-pay"
        className="flex flex-col gap-2.5 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4"
      >
        <h3 id="premium-pay" className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4 shrink-0 text-primary" aria-hidden />
          {t('awaiting', { amount: `${bill.amount} ${bill.currency}` })}
        </h3>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-fg-muted">{t('payRef')}</span>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-surface px-2 py-1.5 text-sm font-semibold">
              {bill.reference}
            </code>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(bill.reference)
                setCopied(true)
              }}
            >
              <Copy className="size-3.5" aria-hidden />
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-fg-muted">{t('payHint', { payTo })}</p>
        <p className="text-[11px] text-fg-subtle">{t('startsWhenConfirmed')}</p>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="premium-buy"
      className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4"
    >
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id="premium-buy" className="text-sm font-semibold">
            {t('approvedTitle')}
          </h3>
          {annual && (
            <p className="text-sm font-semibold">
              {t('price', { price: `${annual.unit_price} ${data?.currency ?? 'ETB'}` })}
            </p>
          )}
          <p className="text-sm leading-relaxed text-fg-muted">{t('value')}</p>
        </div>
      </div>

      {choose.isError && (
        <p role="alert" className="text-xs text-status-bad">
          {(choose.error as Error).message}
        </p>
      )}

      <Button
        type="button"
        disabled={choose.isPending || !annual}
        className="self-start"
        onClick={() => annual && choose.mutate({ period: annual.period, quantity: 1 })}
      >
        {choose.isPending ? t('subscribing') : t('subscribe')}
      </Button>
      <p className="text-[11px] text-fg-subtle">{t('noPaymentHere')}</p>
    </section>
  )
}
