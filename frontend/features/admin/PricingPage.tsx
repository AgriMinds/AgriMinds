'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Coins, History, PencilLine } from 'lucide-react'
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

import { RepriceForm } from './RepriceForm'
import { usePricing, usePricingHistory } from './usePricing'

/**
 * The rate card — what each stakeholder pays, and what they used to pay.
 *
 * Money is rendered from the server's decimal string, never from the cents by dividing here: the
 * API sends both so exactly one place in the system decides how an amount reads.
 *
 * A price is never edited. Repricing writes a new version and closes the old one, so this page
 * can show a stakeholder's whole history and a reader can see the rate any past subscription was
 * actually signed at. That is why the history panel exists rather than an edit-in-place cell.
 */
export function PricingPage() {
  const t = useTranslations('pricing')
  const format = useFormatter()
  const [openHistory, setOpenHistory] = useState<StakeholderName | null>(null)
  const [repricing, setRepricing] = useState<StakeholderName | null>(null)

  const catalogue = usePricing()
  const history = usePricingHistory(openHistory)

  const byStakeholder = new Map((catalogue.data?.tiers ?? []).map((tier) => [tier.stakeholder, tier]))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{t('eyebrow')}</span>
        <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
        <p className="max-w-3xl text-sm text-fg-muted">{t('intro')}</p>
      </header>

      <Card className="p-3.5 sm:p-5">
        <CardHeader>
          <CardHeading>
            <CardIcon>
              <Coins />
            </CardIcon>
            <div className="min-w-0">
              <CardTitle>{t('cardTitle')}</CardTitle>
              <CardDescription>
                {catalogue.data
                  ? t('cardDesc', {
                      currency: catalogue.data.currency,
                      total: catalogue.data.annual_total,
                      asOf: format.dateTime(new Date(catalogue.data.as_of), 'date'),
                    })
                  : null}
              </CardDescription>
            </div>
          </CardHeading>
        </CardHeader>
        <CardContent>
          {catalogue.isError ? (
            <QueryError
              error={catalogue.error}
              onRetry={() => void catalogue.refetch()}
              isRetrying={catalogue.isFetching}
            />
          ) : catalogue.data ? (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-1 text-sm">
                <caption className="sr-only">{t('caption')}</caption>
                <thead>
                  <tr className="text-xs text-fg-muted">
                    <th scope="col" className="px-2 py-1 text-left font-medium">
                      {t('col.stakeholder')}
                    </th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">
                      {t('col.oneTime')}
                    </th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">
                      {t('col.annual')}
                    </th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">
                      {t('col.monthly')}
                    </th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">
                      {t('col.daily')}
                    </th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">
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
                        onHistory={() => setOpenHistory(openHistory === key ? null : key)}
                        onReprice={() => setRepricing(repricing === key ? null : key)}
                        historyOpen={openHistory === key}
                        repriceOpen={repricing === key}
                        repriceSlot={
                          repricing === key ? (
                            <RepriceForm tier={tier} onDone={() => setRepricing(null)} />
                          ) : null
                        }
                        historySlot={
                          openHistory === key ? (
                            <HistoryPanel rows={history.data} loading={history.isPending} />
                          ) : null
                        }
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  tier,
  onHistory,
  onReprice,
  historyOpen,
  repriceOpen,
  repriceSlot,
  historySlot,
}: {
  tier: PricingTierOut
  onHistory: () => void
  onReprice: () => void
  historyOpen: boolean
  repriceOpen: boolean
  repriceSlot: React.ReactNode
  historySlot: React.ReactNode
}) {
  const t = useTranslations('pricing')
  const amount = (value: string) => (value === '0.00' ? <span className="text-fg-subtle">—</span> : value)

  return (
    <>
      <tr className="bg-surface-sunken/60">
        <th scope="row" className="rounded-l-lg px-2 py-2 text-left font-normal">
          <span className="block text-sm font-semibold">{tier.label}</span>
          <span className="block text-[11px] text-fg-subtle">{tier.unit}</span>
        </th>
        <td className="px-2 py-2 text-right tabular-nums">{amount(tier.rates.one_time)}</td>
        <td className="px-2 py-2 text-right font-semibold tabular-nums">{tier.rates.annual}</td>
        <td className="px-2 py-2 text-right tabular-nums">{tier.rates.monthly}</td>
        <td className="px-2 py-2 text-right tabular-nums">{tier.rates.daily}</td>
        <td className="rounded-r-lg px-2 py-2 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={onHistory}
            aria-expanded={historyOpen}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted hover:bg-surface hover:text-fg"
          >
            <History className="size-3.5" aria-hidden />
            {t('action.history')}
          </button>
          <button
            type="button"
            onClick={onReprice}
            aria-expanded={repriceOpen}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted hover:bg-surface hover:text-fg"
          >
            <PencilLine className="size-3.5" aria-hidden />
            {t('action.reprice')}
          </button>
        </td>
      </tr>
      {(repriceSlot || historySlot) && (
        <tr>
          <td colSpan={6} className="px-2 pb-3">
            {repriceSlot}
            {historySlot}
          </td>
        </tr>
      )}
    </>
  )
}

function HistoryPanel({ rows, loading }: { rows: PricingTierOut[] | undefined; loading: boolean }) {
  const t = useTranslations('pricing')
  const format = useFormatter()
  if (loading) return <Skeleton className="h-20" />
  if (!rows?.length) return null
  return (
    <ul className="flex flex-col gap-1 rounded-lg border border-border p-2 text-xs">
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
          <span className="tabular-nums">{t('annualAmount', { amount: row.rates.annual })}</span>
        </li>
      ))}
    </ul>
  )
}
