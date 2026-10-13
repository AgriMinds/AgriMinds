'use client'

import { useId, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import type { PricingTierOut, StakeholderName } from '@agriminds/api-types'
import { Button } from '@/components/ui/button'

import { useReprice } from './usePricing'

/**
 * Supersede one stakeholder's price from a date.
 *
 * The form takes money the way a person writes it and converts once, here, on submit. Parsing is
 * done on the decimal string rather than by multiplying a float by 100: `19.99 * 100` is
 * 1998.9999999999998, and rounding that is how a rate card acquires a cent of drift.
 *
 * `effective_from` defaults to tomorrow, never today, because the API refuses a date that is not
 * after the start of the price in force — and the price in force usually started today on a fresh
 * install. Defaulting to a date the server will reject teaches the user nothing.
 */
export function RepriceForm({ tier, onDone }: { tier: PricingTierOut; onDone: () => void }) {
  const t = useTranslations('pricing')
  const id = useId()
  const reprice = useReprice()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [form, setForm] = useState({
    one_time: tier.rates.one_time,
    annual: tier.rates.annual,
    monthly: tier.rates.monthly,
    daily: tier.rates.daily,
    api_quota_monthly: String(tier.api_quota_monthly),
    effective_from: tomorrow.toISOString().slice(0, 10),
  })

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    reprice.mutate(
      {
        stakeholder: tier.stakeholder as StakeholderName,
        change: {
          one_time_cents: toCents(form.one_time),
          annual_cents: toCents(form.annual),
          monthly_cents: toCents(form.monthly),
          daily_cents: toCents(form.daily),
          api_quota_monthly: Number(form.api_quota_monthly) || 0,
          effective_from: form.effective_from,
        },
      },
      { onSuccess: onDone },
    )
  }

  const money = (key: 'one_time' | 'annual' | 'monthly' | 'daily') => (
    <label className="flex flex-col gap-1 text-xs" htmlFor={`${id}-${key}`}>
      <span className="text-fg-muted">{t(`col.${camel(key)}`)}</span>
      <input
        id={`${id}-${key}`}
        inputMode="decimal"
        pattern="[0-9]*\.?[0-9]*"
        required
        className="w-28 rounded-md border border-border bg-surface px-2 py-1 text-right tabular-nums"
        {...field(key)}
      />
    </label>
  )

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface-sunken/40 p-3"
      aria-label={t('repriceLabel', { tier: tier.label })}
    >
      <div className="flex flex-wrap items-end gap-3">
        {money('one_time')}
        {money('annual')}
        {money('monthly')}
        {money('daily')}
        <label className="flex flex-col gap-1 text-xs" htmlFor={`${id}-quota`}>
          <span className="text-fg-muted">{t('col.api')}</span>
          <input
            id={`${id}-quota`}
            inputMode="numeric"
            pattern="[0-9]*"
            required
            className="w-28 rounded-md border border-border bg-surface px-2 py-1 text-right tabular-nums"
            {...field('api_quota_monthly')}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" htmlFor={`${id}-from`}>
          <span className="text-fg-muted">{t('effectiveFrom')}</span>
          <input
            id={`${id}-from`}
            type="date"
            required
            className="rounded-md border border-border bg-surface px-2 py-1"
            {...field('effective_from')}
          />
        </label>
      </div>

      <p className="text-[11px] text-fg-subtle">{t('supersedeNote', { currency: tier.currency })}</p>

      {reprice.isError && (
        <p role="alert" className="text-xs text-status-bad">
          {(reprice.error as Error).message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={reprice.isPending}>
          {reprice.isPending ? t('saving') : t('save')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}

function camel(key: string): string {
  return key === 'one_time' ? 'oneTime' : key
}

/**
 * A decimal string to integer cents, without ever putting the amount through a float.
 * "600" -> 60000, "0.30" -> 30, "1.6" -> 160. More than two decimals is rejected by the caller's
 * pattern; anything that slips through is truncated rather than rounded up into a higher charge.
 */
export function toCents(amount: string): number {
  const [whole, fraction = ''] = amount.trim().split('.')
  const cents = (fraction + '00').slice(0, 2)
  return Number(whole || '0') * 100 + Number(cents)
}
