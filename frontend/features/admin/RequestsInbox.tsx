'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Copy, Inbox, Mail, Phone } from 'lucide-react'
import { STAKEHOLDERS, type AccessRequestOut, type DecisionResult } from '@agriminds/api-types'
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

import { useAccessRequests, useDecideRequest } from './useRequests'

/**
 * Everyone who has asked to buy, and what was done about it.
 *
 * Approving an organisation enquiry creates the account, so the segment is chosen here rather than
 * taken from the form: the price follows from the segment, and an enquirer who called themselves a
 * ministry would otherwise price themselves. The enquirer's own description is shown beside the
 * selector so the decision is informed rather than blind.
 */
export function RequestsInbox() {
  const t = useTranslations('requests')
  const [openOnly, setOpenOnly] = useState(true)
  const inbox = useAccessRequests(openOnly)

  const rows = inbox.data ?? []

  return (
    <>
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 pt-8 pb-7 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <Inbox className="size-3.5" aria-hidden /> {t('eyebrow')}
          </p>
          <h1 className="font-display text-display font-bold">{t('title')}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">{t('intro')}</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Card className="p-3.5 sm:p-5">
          <CardHeader>
            <CardHeading>
              <CardIcon>
                <Inbox />
              </CardIcon>
              <div className="min-w-0">
                <CardTitle>{t('cardTitle')}</CardTitle>
                <CardDescription>{t('cardDesc')}</CardDescription>
              </div>
            </CardHeading>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex items-center gap-2 self-start text-xs text-fg-muted">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
                className="size-4 rounded border-border"
              />
              {t('openOnly')}
            </label>

            {inbox.isError ? (
              <QueryError
                error={inbox.error}
                onRetry={() => void inbox.refetch()}
                isRetrying={inbox.isFetching}
              />
            ) : inbox.isPending ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : rows.length ? (
              <ul className="flex flex-col gap-3">
                {rows.map((row) => (
                  <RequestRow key={row.id} row={row} />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
                <Inbox className="size-6 text-fg-subtle" aria-hidden />
                <p className="text-sm font-medium">{t('empty')}</p>
                <p className="max-w-sm text-xs text-fg-muted">{t('emptyHint')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function RequestRow({ row }: { row: AccessRequestOut }) {
  const t = useTranslations('requests')
  const ts = useTranslations('organizations.stakeholder')
  const format = useFormatter()
  const decide = useDecideRequest()
  const [segment, setSegment] = useState(row.stakeholder ?? 'cooperative')
  const [note, setNote] = useState('')
  const [dismissed, setDismissed] = useState(false)

  const open = row.status === 'new' || row.status === 'contacted'

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{row.organization_name ?? row.contact_name}</p>
          <p className="text-xs text-fg-subtle">
            {row.kind === 'farmer_premium' ? t('kind.farmer') : t('kind.organization')}
            {row.stakeholder && ` · ${t('selfDescribed', { segment: ts(row.stakeholder) })}`}
          </p>
        </div>
        <Badge>{t(`status.${row.status}`)}</Badge>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span>{row.contact_name}</span>
        {row.contact_email && (
          <a href={`mailto:${row.contact_email}`} className="flex items-center gap-1 underline">
            <Mail className="size-3" aria-hidden />
            {row.contact_email}
          </a>
        )}
        {row.contact_phone && (
          <a href={`tel:${row.contact_phone}`} className="flex items-center gap-1 underline">
            <Phone className="size-3" aria-hidden />
            {row.contact_phone}
          </a>
        )}
        <span>{format.dateTime(new Date(row.created_at), 'date')}</span>
      </div>

      {row.message && (
        <p className="rounded-lg bg-surface-sunken/60 px-2.5 py-2 text-xs leading-relaxed">{row.message}</p>
      )}

      {open ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          {row.kind === 'organization' && (
            <label className="flex flex-col gap-1 text-xs">
              {/* The price follows from the segment, so it is decided here, not on the form. */}
              <span className="text-fg-muted">{t('placeIn')}</span>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as typeof segment)}
                className="rounded-md border border-border bg-surface px-2 py-1.5"
              >
                {STAKEHOLDERS.filter((s) => s !== 'farmer_premium').map((key) => (
                  <option key={key} value={key}>
                    {ts(key)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
            <span className="text-fg-muted">{t('note')}</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5"
            />
          </label>
          <Button
            size="sm"
            disabled={decide.isPending}
            onClick={() =>
              decide.mutate({
                id: row.id,
                decision: { status: 'approved', stakeholder: segment, note: note || null },
              })
            }
          >
            {t('approve')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={decide.isPending}
            onClick={() =>
              decide.mutate({ id: row.id, decision: { status: 'declined', note: note || null } })
            }
          >
            {t('decline')}
          </Button>
        </div>
      ) : (
        row.decision_note && (
          <p className="border-t border-border pt-2 text-xs text-fg-muted">
            {t('decided', { note: row.decision_note })}
          </p>
        )
      )}

      {decide.data?.invitation_token && !dismissed && (
        <Invitation result={decide.data} onDismiss={() => setDismissed(true)} />
      )}

      {/* Approved, and nobody to invite: the account exists but has no way in yet. */}
      {decide.data && decide.data.invited_email === null && row.kind === 'organization' && (
        <p role="status" className="rounded-lg border border-border px-2.5 py-2 text-xs text-fg-muted">
          {t('noContactEmail')}
        </p>
      )}

      {decide.isError && (
        <p role="alert" className="text-xs text-status-bad">
          {(decide.error as Error).message}
        </p>
      )}
    </li>
  )
}

/**
 * The invitation, shown once and never again.
 *
 * There is no mail server here, so this is the only moment the token exists in readable form:
 * whoever approves copies it and relays it by whatever channel they already use with the customer.
 * Lost means issuing a fresh invitation, not looking this one up -- only its hash is stored.
 */
function Invitation({ result, onDismiss }: { result: DecisionResult; onDismiss: () => void }) {
  const t = useTranslations('requests')
  const format = useFormatter()
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/invite/${result.invitation_token}`

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-primary bg-surface-sunken p-3"
    >
      <p className="text-xs font-semibold">{t('invitedOnce', { email: result.invited_email ?? '' })}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-surface px-2 py-1.5 text-xs">
          {link}
        </code>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(link)
            setCopied(true)
          }}
        >
          <Copy className="size-3.5" aria-hidden />
          {copied ? t('copied') : t('copy')}
        </Button>
      </div>
      {result.invitation_expires_at && (
        <p className="text-[11px] text-fg-muted">
          {t('invitedHint', {
            date: format.dateTime(new Date(result.invitation_expires_at), 'date'),
          })}
        </p>
      )}
      <Button type="button" size="sm" variant="ghost" className="self-start" onClick={onDismiss}>
        {t('dismiss')}
      </Button>
    </div>
  )
}
