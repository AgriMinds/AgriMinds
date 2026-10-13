'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { AlertTriangle, CalendarClock, CreditCard, TrendingUp } from 'lucide-react'
import type { RevenueByStakeholder } from '@agriminds/api-types'
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
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { barWidth, formatCompact, formatMoney } from '@/features/admin/money'

import { OutstandingInvoices } from './OutstandingInvoices'
import { useRevenue } from './usePlans'

/**
 * Billing as the person who runs the platform sees it, rather than as a customer.
 *
 * An administrator has no organisation of their own -- they operate the platform, they do not buy
 * from it -- so the customer's plans page has nothing to tell them. Sending them here instead of
 * to a refusal is the difference between a page and a dead end.
 *
 * Only settled money appears. A chosen-but-unpaid subscription sits in "to confirm" below and is
 * counted nowhere above it, because revenue that includes unpaid invoices is a forecast wearing a
 * ledger's clothes.
 */
export function AdminBillingPage() {
  const t = useTranslations('revenue')
  const revenue = useRevenue()
  const data = revenue.data

  return (
    <>
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 pt-8 pb-7 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <TrendingUp className="size-3.5" aria-hidden /> {t('eyebrow')}
          </p>
          <h1 className="font-display text-display font-bold">{t('title')}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">{t('intro')}</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {revenue.isError ? (
          <QueryError
            error={revenue.error}
            onRetry={() => void revenue.refetch()}
            isRetrying={revenue.isFetching}
          />
        ) : revenue.isPending ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Figure label={t('arr')} value={formatMoney(data.arr, data.currency)} hint={t('arrHint')} />
              <Figure label={t('mrr')} value={formatMoney(data.mrr, data.currency)} hint={t('mrrHint')} />
              <Figure
                label={t('active')}
                value={String(data.active_subscriptions)}
                hint={t('activeHint')}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-12">
              <div className="flex flex-col gap-5 xl:col-span-7">
                <BySegment rows={data.by_stakeholder} currency={data.currency} />
              </div>
              <div className="flex flex-col gap-5 xl:col-span-5">
                <OutstandingInvoices />
                <Watchlist
                  renewals={data.renewals_due}
                  lapsed={data.lapsed}
                  currency={data.currency}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-3.5 sm:p-4">
      <p className="text-xs font-semibold tracking-wider text-fg-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-fg-subtle">{hint}</p>
    </Card>
  )
}

/** Where the money comes from. Bars are relative to the largest segment, not to a target. */
function BySegment({ rows, currency }: { rows: RevenueByStakeholder[]; currency: string }) {
  const t = useTranslations('revenue')
  const largest = Math.max(1, ...rows.map((r) => r.annualised_cents))

  return (
    <Card className="p-3.5 sm:p-5">
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <CreditCard />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('bySegment')}</CardTitle>
            <CardDescription>{t('bySegmentDesc')}</CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.stakeholder} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs text-fg-subtle">
                      {t('count', { count: row.subscriptions })}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatCompact(row.annualised, currency)}
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: barWidth(row.annualised_cents, largest) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-fg-muted">
            {t('noRevenue')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * The two lists worth acting on: what is about to renew, and what has already lapsed.
 *
 * A lapsed subscription is revenue that has already stopped, so it is shown apart from the
 * renewals rather than mixed into one list of dates.
 */
function Watchlist({
  renewals,
  lapsed,
  currency,
}: {
  renewals: { organization_name: string; ends_on: string | null; annualised: string }[]
  lapsed: { organization_name: string; ends_on: string | null; annualised: string }[]
  currency: string
}) {
  const t = useTranslations('revenue')
  const format = useFormatter()

  const row = (
    item: { organization_name: string; ends_on: string | null; annualised: string },
    key: string,
  ) => (
    <li key={key} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
      <span className="min-w-0 truncate">{item.organization_name}</span>
      <span className="flex items-baseline gap-2 text-xs">
        {item.ends_on && (
          <span className="text-fg-subtle">{format.dateTime(new Date(item.ends_on), 'date')}</span>
        )}
        <span className="font-semibold tabular-nums">{formatCompact(item.annualised, currency)}</span>
      </span>
    </li>
  )

  return (
    <Card className="p-3.5 sm:p-5">
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <CalendarClock />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('watchlist')}</CardTitle>
            <CardDescription>{t('watchlistDesc')}</CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-fg-muted uppercase">
            {t('renewing')}
          </h3>
          {renewals.length ? (
            <ul className="flex flex-col gap-1.5">{renewals.map((r, i) => row(r, `r${i}`))}</ul>
          ) : (
            <p className="text-xs text-fg-subtle">{t('noRenewals')}</p>
          )}
        </section>

        <section className="flex flex-col gap-2 border-t border-border pt-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-fg-muted uppercase">
            {t('lapsed')}
            {lapsed.length > 0 && (
              <Badge>
                <AlertTriangle className="size-3" aria-hidden />
                {lapsed.length}
              </Badge>
            )}
          </h3>
          {lapsed.length ? (
            <ul className="flex flex-col gap-1.5">{lapsed.map((r, i) => row(r, `l${i}`))}</ul>
          ) : (
            <p className="text-xs text-fg-subtle">{t('noLapsed')}</p>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
