'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Landmark } from 'lucide-react'
import type { InvoiceOut, PaymentConfirmation } from '@agriminds/api-types'
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
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/features/admin/money'

import { useConfirmPayment, useOutstandingInvoices } from './usePlans'

const METHODS = ['bank_transfer', 'telebirr', 'cheque', 'cash', 'other'] as const

/**
 * The step a card gateway would do for you: somebody checks the money arrived and says so.
 *
 * Confirming here is what starts the subscription and what moves the amount into ARR, so the
 * payer's own reference — a bank slip, a telebirr id — is captured with it. Without that, a
 * disputed payment has nothing on this side to match against the bank statement.
 */
export function OutstandingInvoices() {
  const t = useTranslations('plans.admin')
  const ti = useTranslations('plans')
  const format = useFormatter()
  const invoices = useOutstandingInvoices()
  const confirm = useConfirmPayment()
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState<PaymentConfirmation>({ method: 'bank_transfer' })

  return (
    <Card className="p-3.5 sm:p-5">
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <Landmark />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('desc')}</CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent>
        {invoices.isError ? (
          <QueryError
            error={invoices.error}
            onRetry={() => void invoices.refetch()}
            isRetrying={invoices.isFetching}
          />
        ) : invoices.isPending ? (
          <Skeleton className="h-24" />
        ) : invoices.data?.length ? (
          <ul className="flex flex-col gap-2">
            {invoices.data.map((invoice: InvoiceOut) => (
              <li key={invoice.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 flex-col">
                    {/* The payer's name first: one farmer's ETB 465 is otherwise indistinguishable
                        from another's, and the reference alone says nothing about who owes it. */}
                    <span className="truncate text-sm font-medium">{invoice.payer_name}</span>
                    <span className="text-xs text-fg-subtle">
                      <code className="font-semibold">{invoice.reference}</code> · {invoice.description}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">
                      {formatMoney(invoice.amount, invoice.currency)}
                    </span>
                    {invoice.overdue && <Badge>{ti('overdue')}</Badge>}
                    <span className="text-xs text-fg-subtle">
                      {ti('due', { date: format.dateTime(new Date(invoice.due_on), 'date') })}
                    </span>
                    <Button
                      size="sm"
                      variant={open === invoice.id ? 'ghost' : 'default'}
                      onClick={() => setOpen(open === invoice.id ? null : invoice.id)}
                    >
                      {t('confirm')}
                    </Button>
                  </span>
                </div>

                {open === invoice.id && (
                  <form
                    aria-label={t('confirm')}
                    className="flex flex-wrap items-end gap-2 border-t border-border pt-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      confirm.mutate(
                        { id: invoice.id, confirmation: form },
                        { onSuccess: () => setOpen(null) },
                      )
                    }}
                  >
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-fg-muted">{t('method')}</span>
                      <select
                        value={form.method}
                        onChange={(e) =>
                          setForm({ ...form, method: e.target.value as PaymentConfirmation['method'] })
                        }
                        className="rounded-md border border-border bg-surface px-2 py-1.5"
                      >
                        {METHODS.map((m) => (
                          <option key={m} value={m}>
                            {t(`methodOption.${m}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
                      {/* Captured so a disputed payment can be matched to the bank statement. */}
                      <span className="text-fg-muted">{t('ref')}</span>
                      <input
                        value={form.payment_reference ?? ''}
                        onChange={(e) => setForm({ ...form, payment_reference: e.target.value })}
                        className="rounded-md border border-border bg-surface px-2 py-1.5"
                      />
                    </label>
                    <Button type="submit" size="sm" disabled={confirm.isPending}>
                      {t('confirm')}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-fg-muted">
            {t('none')}
          </p>
        )}
        {confirm.isError && (
          <p role="alert" className="mt-2 text-xs text-status-bad">
            {(confirm.error as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
