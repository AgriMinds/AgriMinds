'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Check, Copy, CreditCard, FileText, Landmark } from 'lucide-react'
import type { CheckoutResult, InvoiceOut, PlanOption } from '@agriminds/api-types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardIcon,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QueryError } from '@/components/ui/query-state'
import { ApiError } from '@/lib/api/client'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/features/admin/money'

import { useChoosePlan, useMyInvoices, usePlans } from './usePlans'

/**
 * Choose a plan, and get a bill for it.
 *
 * A card-based service would take payment here and start immediately. This one cannot: no money
 * moves through the platform, by choice. So the button raises an invoice with a reference to quote
 * on a bank transfer, and the plan starts when somebody confirms the payment arrived.
 *
 * That is said on the button and again on the invoice, because the dangerous version of this page
 * is the one that looks like a checkout. A customer who believes they have paid and has not is a
 * support call at best and a disputed invoice at worst.
 */
export function PlansPage() {
  const t = useTranslations('plans')
  const plans = usePlans()
  const invoices = useMyInvoices()
  const choose = useChoosePlan()
  const [quantity, setQuantity] = useState(1)
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null)

  const data = plans.data
  const currency = data?.currency ?? 'ETB'
  const current = data?.current ?? null

  return (
    <>
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 pt-8 pb-7 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <CreditCard className="size-3.5" aria-hidden /> {t('eyebrow')}
          </p>
          <h1 className="font-display text-display font-bold">{t('title')}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">{t('intro')}</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {plans.isError ? (
          // A person with no organisation gets the API's own explanation, which says what to do.
          // No retry offered in that case: nothing about pressing it again can change the answer.
          <QueryError
            error={plans.error}
            onRetry={
              plans.error instanceof ApiError && plans.error.status === 403
                ? undefined
                : () => void plans.refetch()
            }
            isRetrying={plans.isFetching}
          />
        ) : plans.isPending ? (
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : data ? (
          <>
            <Card className="p-3.5 sm:p-5">
              <CardHeader>
                <CardHeading>
                  <CardIcon>
                    <CreditCard />
                  </CardIcon>
                  <div className="min-w-0">
                    <CardTitle>{data.label}</CardTitle>
                    <CardDescription>
                      {current
                        ? t('currentPlan', {
                            period: t(`period.${current.billing_period}`),
                            status: t(`status.${current.status}`),
                          })
                        : t('noPlan')}
                    </CardDescription>
                  </div>
                </CardHeading>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {data.value_note && (
                  <p className="rounded-lg border border-border bg-surface-sunken/50 px-3 py-2 text-sm leading-relaxed text-fg-muted">
                    {data.value_note}
                  </p>
                )}

                <div className="grid gap-3 md:grid-cols-3">
                  {data.options.map((option) => (
                    <PlanCard
                      key={option.period}
                      option={option}
                      currency={currency}
                      unit={data.unit}
                      quota={data.api_quota_monthly}
                      chosen={current?.billing_period === option.period}
                      disabled={Boolean(current) || choose.isPending}
                      onChoose={() =>
                        choose.mutate(
                          { period: option.period, quantity },
                          { onSuccess: setCheckout },
                        )
                      }
                    />
                  ))}
                </div>

                {!current && (
                  <label className="flex items-center gap-2 self-start text-xs">
                    <span className="text-fg-muted">{t('quantity', { unit: data.unit })}</span>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-right tabular-nums"
                    />
                  </label>
                )}

                {choose.isError && (
                  <p role="alert" className="text-sm text-status-bad">
                    {(choose.error as Error).message}
                  </p>
                )}
              </CardContent>
            </Card>

            {checkout && <HowToPay checkout={checkout} onDismiss={() => setCheckout(null)} />}

            <Invoices rows={invoices.data} loading={invoices.isPending} currency={currency} />
          </>
        ) : null}
      </div>
    </>
  )
}

function PlanCard({
  option,
  currency,
  unit,
  quota,
  chosen,
  disabled,
  onChoose,
}: {
  option: PlanOption
  currency: string
  unit: string
  quota: number
  chosen: boolean
  disabled: boolean
  onChoose: () => void
}) {
  const t = useTranslations('plans')
  // Worth highlighting only when committing actually saves something. On a flat rate card it
  // would be a badge that promises a discount the customer will not find on their invoice.
  const saves = option.saving_vs_shortest_pct >= 1

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        chosen ? 'border-primary bg-primary/[0.04]' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold">{t(`period.${option.period}`)}</span>
        {chosen ? <Badge>{t('yourPlan')}</Badge> : saves ? (
          <Badge>{t('saves', { pct: option.saving_vs_shortest_pct })}</Badge>
        ) : null}
      </div>

      <div className="flex flex-col">
        <span className="font-display text-2xl font-bold tabular-nums">
          {formatMoney(option.unit_price, currency)}
        </span>
        <span className="text-xs text-fg-subtle">
          {t(`per.${option.period}`)} · {unit}
        </span>
      </div>

      <p className="text-xs text-fg-muted">
        {t('annualised', { amount: formatMoney(option.annualised, currency) })}
      </p>

      {quota > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-fg-muted">
          <Check className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
          {t('apiIncluded', { n: quota.toLocaleString() })}
        </p>
      )}

      <Button
        className="mt-auto"
        size="sm"
        disabled={disabled}
        onClick={onChoose}
        variant={chosen ? 'ghost' : 'default'}
      >
        {chosen ? t('yourPlan') : t('choose')}
      </Button>
    </div>
  )
}

function HowToPay({ checkout, onDismiss }: { checkout: CheckoutResult; onDismiss: () => void }) {
  const t = useTranslations('plans')
  const [copied, setCopied] = useState(false)

  return (
    <Card className="border-primary p-3.5 sm:p-5">
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <Landmark />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('howToPay')}</CardTitle>
            {/* Said plainly: nothing has been paid, and the plan has not started. */}
            <CardDescription>{t('notYetActive')}</CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-fg-muted">{t('payTo')}</dt>
            <dd className="text-sm font-medium">{checkout.pay_to}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">{t('amount')}</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {checkout.invoice.amount} {checkout.invoice.currency}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-sunken/60 p-3">
          <span className="text-xs text-fg-muted">{t('reference')}</span>
          <code className="rounded bg-surface px-2 py-1 text-sm font-semibold">
            {checkout.invoice.reference}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(checkout.invoice.reference)
              setCopied(true)
            }}
          >
            <Copy className="size-3.5" aria-hidden />
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>

        <p className="text-sm leading-relaxed text-fg-muted">{checkout.instructions}</p>
        <Button size="sm" variant="ghost" className="self-start" onClick={onDismiss}>
          {t('dismiss')}
        </Button>
      </CardContent>
    </Card>
  )
}

function Invoices({
  rows,
  loading,
  currency,
}: {
  rows: InvoiceOut[] | undefined
  loading: boolean
  currency: string
}) {
  const t = useTranslations('plans')
  const format = useFormatter()
  if (loading) return <Skeleton className="h-32" />
  if (!rows?.length) return null

  return (
    <Card className="p-3.5 sm:p-5">
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <FileText />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('invoices')}</CardTitle>
            <CardDescription>{t('invoicesDesc')}</CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {rows.map((invoice) => (
            <li
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 flex-col">
                <code className="text-xs font-semibold">{invoice.reference}</code>
                <span className="text-xs text-fg-subtle">{invoice.description}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums">{formatMoney(invoice.amount, currency)}</span>
                <Badge>
                  {invoice.overdue ? t('overdue') : t(`invoiceStatus.${invoice.status}`)}
                </Badge>
                <span className="text-xs text-fg-subtle">
                  {t('due', { date: format.dateTime(new Date(invoice.due_on), 'date') })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
