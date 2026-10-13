'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Coins, History, PencilLine, Plug, Receipt } from 'lucide-react'
import { STAKEHOLDERS, type PricingTierOut, type StakeholderName } from '@agriminds/api-types'
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
import { Stat } from '@/components/ui/stat'

import { formatCompact, formatMoney, formatRequests } from './money'
import { RepriceForm } from './RepriceForm'
import { usePricing, usePricingHistory } from './usePricing'

/**
 * The rate card — what each stakeholder pays, and what they used to pay.
 *
 * The thing worth seeing here is not eight rows of numbers, it is the shape of the business: how
 * much one of everything is worth a year, and how much API capacity that sells. So the page leads
 * with those two figures and lets the table carry the detail underneath, rather than opening on a
 * grid the reader has to add up themselves.
 *
 * Within a row the annual price is the one that matters — it is what contracts are written at —
 * so it is the only figure at full weight. Monthly, daily and the perpetual licence are derived
 * from it by a fixed rule and are set quieter, which is also how they behave commercially.
 *
 * Money is rendered from the server's decimal string, never from the cents by dividing here.
 */
export function PricingPage() {
  const t = useTranslations('pricing')
  const format = useFormatter()
  const [openHistory, setOpenHistory] = useState<StakeholderName | null>(null)
  const [repricing, setRepricing] = useState<StakeholderName | null>(null)

  const catalogue = usePricing()
  const history = usePricingHistory(openHistory)

  const tiers = catalogue.data?.tiers ?? []
  const byStakeholder = new Map(tiers.map((tier) => [tier.stakeholder, tier]))
  const currency = catalogue.data?.currency ?? 'ETB'
  const totalQuota = tiers.reduce((sum, tier) => sum + tier.api_quota_monthly, 0)

  return (
    <>
      {/* The shell gives `main` no padding, so every page supplies its own container: a banded
          header over `max-w-[1600px]`, then the content at the same width. Without it the page
          sits flush against the fixed 280px sidebar, which is what the other pages avoid. */}
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 pt-8 pb-7 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <Coins className="size-3.5" aria-hidden /> {t('eyebrow')}
          </p>
          <h1 className="font-display text-display font-bold">{t('title')}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">{t('intro')}</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            icon={<Receipt />}
            label={t('stat.contractValue')}
            value={catalogue.data ? formatCompact(catalogue.data.annual_total, currency) : '—'}
            detail={t('stat.contractValueDetail')}
            loading={catalogue.isPending}
          />
          <Stat
            icon={<Plug />}
            label={t('stat.apiCapacity')}
            value={catalogue.data ? formatRequests(totalQuota) : '—'}
            detail={t('stat.apiCapacityDetail')}
            loading={catalogue.isPending}
          />
          <Stat
            icon={<Coins />}
            label={t('stat.tiers')}
            value={catalogue.data ? String(tiers.length) : '—'}
            detail={
              catalogue.data
                ? t('stat.tiersDetail', { asOf: format.dateTime(new Date(catalogue.data.as_of), 'date') })
                : undefined
            }
            loading={catalogue.isPending}
          />
        </div>

        <Card className="p-3.5 sm:p-5">
          <CardHeader>
            <CardHeading>
              <CardIcon>
                <Coins />
              </CardIcon>
              <div className="min-w-0">
                <CardTitle>{t('cardTitle')}</CardTitle>
                <CardDescription>{t('cardDesc', { currency })}</CardDescription>
              </div>
            </CardHeading>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {catalogue.isError ? (
              <QueryError
                error={catalogue.error}
                onRetry={() => void catalogue.refetch()}
                isRetrying={catalogue.isFetching}
              />
            ) : catalogue.data ? (
              <>
                {/* The sidebar is a fixed 280px column from `lg` up, so a 1024px laptop leaves this
                  table under 700px — seven columns of currency do not fit, and a price list that
                  scrolls sideways is one nobody reads across. The table therefore waits for `xl`,
                  and below it the same rows are cards: one column on a phone, two once there is
                  room. No rate is hidden at any width, because a rate card that drops rates is
                  not a rate card. */}
                <div className="hidden overflow-x-auto xl:block">
                  <table className="w-full border-separate border-spacing-y-1.5 text-sm">
                    <caption className="sr-only">{t('caption')}</caption>
                    <thead>
                      <tr className="text-[11px] tracking-wide text-fg-subtle uppercase">
                        <th scope="col" className="px-3 py-1 text-left font-medium">
                          {t('col.stakeholder')}
                        </th>
                        <th scope="col" className="px-3 py-1 text-right font-medium">
                          {t('col.annual')}
                        </th>
                        <th scope="col" className="px-3 py-1 text-right font-medium">
                          {t('col.monthly')}
                        </th>
                        <th scope="col" className="px-3 py-1 text-right font-medium">
                          {t('col.daily')}
                        </th>
                        <th scope="col" className="px-3 py-1 text-right font-medium">
                          {t('col.oneTime')}
                        </th>
                        <th scope="col" className="px-3 py-1 text-right font-medium">
                          {t('col.api')}
                        </th>
                        <th scope="col" className="px-3 py-1 text-right font-medium">
                          <span className="sr-only">{t('col.actions')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {STAKEHOLDERS.map((key) => {
                        const tier = byStakeholder.get(key)
                        if (!tier) return null
                        return (
                          <Row
                            key={key}
                            tier={tier}
                            currency={currency}
                            onHistory={() => setOpenHistory(openHistory === key ? null : key)}
                            onReprice={() => setRepricing(repricing === key ? null : key)}
                            historyOpen={openHistory === key}
                            repriceOpen={repricing === key}
                          />
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="grid gap-2 md:grid-cols-2 xl:hidden">
                  {STAKEHOLDERS.map((key) => {
                    const tier = byStakeholder.get(key)
                    if (!tier) return null
                    return (
                      <MobileTier
                        key={key}
                        tier={tier}
                        currency={currency}
                        onHistory={() => setOpenHistory(openHistory === key ? null : key)}
                        onReprice={() => setRepricing(repricing === key ? null : key)}
                        historyOpen={openHistory === key}
                        repriceOpen={repricing === key}
                      />
                    )
                  })}
                </ul>

                {/* The table and the card list are the same rows at two widths, so the expansion
                  renders once underneath both rather than inside each — two copies of a form is
                  two sets of inputs, and whichever one the user did not fill wins on submit. */}
                {repricing && byStakeholder.get(repricing) && (
                  <RepriceForm
                    tier={byStakeholder.get(repricing) as PricingTierOut}
                    onDone={() => setRepricing(null)}
                  />
                )}
                {openHistory && (
                  <HistoryPanel rows={history.data} loading={history.isPending} currency={currency} />
                )}

                <p className="rounded-lg border border-border bg-surface-sunken/50 px-3 py-2 text-xs leading-relaxed text-fg-muted">
                  {t('structure')}
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Row({
  tier,
  currency,
  onHistory,
  onReprice,
  historyOpen,
  repriceOpen,
}: {
  tier: PricingTierOut
  currency: string
  onHistory: () => void
  onReprice: () => void
  historyOpen: boolean
  repriceOpen: boolean
}) {
  const t = useTranslations('pricing')
  const quiet = (value: string) =>
    value === '0.00' ? (
      <span className="text-fg-subtle">—</span>
    ) : (
      <span className="text-fg-muted">{formatMoney(value, currency)}</span>
    )

  return (
    <>
      <tr className="bg-surface-sunken/60 transition-colors hover:bg-surface-sunken">
        <th scope="row" className="rounded-l-lg px-3 py-2.5 text-left font-normal">
          <span className="block text-sm font-semibold">{tier.label}</span>
          <span className="block text-[11px] text-fg-subtle">{tier.unit}</span>
        </th>
        {/* The annual rate is what a contract is written at, so it is the only figure at full
            weight. The rest are derived from it and are set quieter on purpose. */}
        <td className="px-3 py-2.5 text-right text-base font-semibold tabular-nums">
          {formatMoney(tier.rates.annual, currency)}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">{quiet(tier.rates.monthly)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{quiet(tier.rates.daily)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{quiet(tier.rates.one_time)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">
          {tier.api_quota_monthly > 0 ? (
            <span title={t('apiTitle', { n: tier.api_quota_monthly })}>
              {formatRequests(tier.api_quota_monthly)}
            </span>
          ) : (
            <span className="text-fg-subtle">{t('noApi')}</span>
          )}
        </td>
        <td className="rounded-r-lg px-3 py-2.5 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={onHistory}
            aria-expanded={historyOpen}
            className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <History className="size-3.5" aria-hidden />
            {t('action.history')}
          </button>
          <button
            type="button"
            onClick={onReprice}
            aria-expanded={repriceOpen}
            className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PencilLine className="size-3.5" aria-hidden />
            {t('action.reprice')}
          </button>
        </td>
      </tr>
    </>
  )
}

function MobileTier({
  tier,
  currency,
  onHistory,
  onReprice,
  historyOpen,
  repriceOpen,
}: {
  tier: PricingTierOut
  currency: string
  onHistory: () => void
  onReprice: () => void
  historyOpen: boolean
  repriceOpen: boolean
}) {
  const t = useTranslations('pricing')
  const cell = (label: string, value: string) => (
    <div className="flex flex-col">
      <span className="text-[10px] tracking-wide text-fg-subtle uppercase">{label}</span>
      <span className="tabular-nums">
        {value === '0.00' ? <span className="text-fg-subtle">—</span> : formatMoney(value, currency)}
      </span>
    </div>
  )

  return (
    <li className="flex flex-col gap-2.5 rounded-xl border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{tier.label}</span>
          <span className="block text-[11px] text-fg-subtle">{tier.unit}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-base font-semibold tabular-nums">
            {formatMoney(tier.rates.annual, currency)}
          </span>
          <span className="block text-[10px] tracking-wide text-fg-subtle uppercase">{t('col.annual')}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        {cell(t('col.monthly'), tier.rates.monthly)}
        {cell(t('col.daily'), tier.rates.daily)}
        {cell(t('col.oneTime'), tier.rates.one_time)}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <span className="text-[11px] text-fg-muted">
          {tier.api_quota_monthly > 0
            ? `${t('col.api')}: ${formatRequests(tier.api_quota_monthly)}`
            : `${t('col.api')}: ${t('noApi')}`}
        </span>
        <span className="flex gap-1">
          <button
            type="button"
            onClick={onHistory}
            aria-expanded={historyOpen}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-xs text-fg-muted hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-ring"
          >
            <History className="size-4" aria-hidden />
            <span className="sr-only">{t('action.history')}</span>
          </button>
          <button
            type="button"
            onClick={onReprice}
            aria-expanded={repriceOpen}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-xs text-fg-muted hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PencilLine className="size-4" aria-hidden />
            <span className="sr-only">{t('action.reprice')}</span>
          </button>
        </span>
      </div>
    </li>
  )
}

function HistoryPanel({
  rows,
  loading,
  currency,
}: {
  rows: PricingTierOut[] | undefined
  loading: boolean
  currency: string
}) {
  const t = useTranslations('pricing')
  const format = useFormatter()
  if (loading) return <Skeleton className="h-20" />
  if (!rows?.length) return null
  if (rows.length === 1) {
    return <p className="rounded-lg border border-border p-3 text-xs text-fg-muted">{t('noHistory')}</p>
  }
  return (
    <ul className="flex flex-col gap-1.5 rounded-lg border border-border p-3 text-xs">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            {row.is_current ? (
              <Badge>{t('inForce')}</Badge>
            ) : (
              <span className="text-fg-subtle">
                {t('until', { date: format.dateTime(new Date(row.effective_to as string), 'date') })}
              </span>
            )}
            <span className="text-fg-muted">
              {t('from', { date: format.dateTime(new Date(row.effective_from), 'date') })}
            </span>
          </span>
          <span className="tabular-nums">
            {t('annualAmount', { amount: formatMoney(row.rates.annual, row.currency || currency) })}
          </span>
        </li>
      ))}
    </ul>
  )
}
