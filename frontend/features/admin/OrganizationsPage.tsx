'use client'

import { useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Activity, Building2, Copy, KeyRound, Plug, Plus } from 'lucide-react'
import { STAKEHOLDERS, type ApiKeyIssued, type OrganizationOut } from '@agriminds/api-types'
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
import { Stat } from '@/components/ui/stat'

import { barWidth, formatRequests, formatShare } from './money'
import {
  useCreateOrganization,
  useIssueKey,
  useOrganizationKeys,
  useOrganizationUsage,
  useOrganizations,
  useRevokeKey,
} from './useOrganizations'

/**
 * Paying accounts and the credentials they call the API with.
 *
 * The quota bar is the point of the page. An account's allowance comes from the tier in force for
 * its stakeholder type, not from a number copied onto the account, so repricing a tier moves every
 * subscriber at once and this page always shows what they are actually entitled to today.
 *
 * A newly issued key is shown in full exactly once, in a panel that says so plainly. There is no
 * way back to it: the platform keeps a SHA-256 hash and the last four characters, and nothing else.
 */
export function OrganizationsPage() {
  const t = useTranslations('organizations')
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const organizations = useOrganizations()
  const accounts = useMemo(() => organizations.data ?? [], [organizations.data])

  // Land on the first account rather than an empty panel telling the reader to click something.
  // Derived rather than written into state by an effect: an effect that sets state on mount costs
  // a second render pass, and this needs no state of its own — an explicit choice wins, and the
  // first account stands in until one is made.
  const active = selected ?? accounts[0]?.id ?? null

  const totals = accounts.reduce(
    (acc, org) => ({
      keys: acc.keys + org.active_keys,
      used: acc.used + org.api_requests_this_month,
      quota: acc.quota + org.api_quota_monthly,
    }),
    { keys: 0, used: 0, quota: 0 },
  )

  return (
    <>
      {/* Same container as every other page: banded header, then content at max-w-[1600px]. */}
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 pt-8 pb-7 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <Building2 className="size-3.5" aria-hidden /> {t('eyebrow')}
          </p>
          <h1 className="font-display text-display font-bold">{t('title')}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">{t('intro')}</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            icon={<Building2 />}
            label={t('stat.accounts')}
            value={organizations.data ? String(accounts.length) : '—'}
            detail={t('stat.accountsDetail')}
            loading={organizations.isPending}
          />
          <Stat
            icon={<KeyRound />}
            label={t('stat.keys')}
            value={organizations.data ? String(totals.keys) : '—'}
            detail={t('stat.keysDetail')}
            loading={organizations.isPending}
          />
          <Stat
            icon={<Activity />}
            label={t('stat.requests')}
            value={organizations.data ? formatRequests(totals.used) : '—'}
            detail={
              organizations.data
                ? t('stat.requestsDetail', { share: formatShare(totals.used, totals.quota) })
                : undefined
            }
            loading={organizations.isPending}
          />
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-12">
          <div className="flex flex-col gap-5 xl:col-span-7">
            <Card className="p-3.5 sm:p-5">
              <CardHeader>
                <CardHeading>
                  <CardIcon>
                    <Building2 />
                  </CardIcon>
                  <div className="min-w-0">
                    <CardTitle>{t('accounts')}</CardTitle>
                    <CardDescription>{t('accountsDesc')}</CardDescription>
                  </div>
                </CardHeading>
              </CardHeader>
              <CardContent className="flex flex-col">
                {organizations.isError ? (
                  <QueryError
                    error={organizations.error}
                    onRetry={() => void organizations.refetch()}
                    isRetrying={organizations.isFetching}
                  />
                ) : accounts.length ? (
                  <ul className="flex flex-col gap-2">
                    {accounts.map((org) => (
                      <AccountRow
                        key={org.id}
                        org={org}
                        selected={active === org.id}
                        onSelect={() => setSelected(active === org.id ? null : org.id)}
                      />
                    ))}
                  </ul>
                ) : organizations.isPending ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }, (_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : (
                  <EmptyState onAdd={() => setAdding(true)} />
                )}

                {adding ? (
                  <NewAccount onDone={() => setAdding(false)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="mt-3 inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg border border-dashed border-border px-3 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {t('addTitle')}
                  </button>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-5">
            {active ? (
              <Credentials organizationId={active} />
            ) : (
              <Card className="p-3.5 sm:p-5">
                <CardContent>
                  <p className="text-sm text-fg-muted">{t('pickAccount')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function AccountRow({
  org,
  selected,
  onSelect,
}: {
  org: OrganizationOut
  selected: boolean
  onSelect: () => void
}) {
  const t = useTranslations('organizations')
  const used = org.api_requests_this_month
  const quota = org.api_quota_monthly
  const share = formatShare(used, quota)
  const tight = quota > 0 && used / quota >= 0.8

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
          selected ? 'border-primary bg-surface-sunken' : 'border-border hover:bg-surface-sunken/60'
        }`}
      >
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{org.name}</span>
            <span className="block text-[11px] text-fg-subtle">{t(`stakeholder.${org.stakeholder}`)}</span>
          </span>
          <span className="flex items-center gap-2 text-xs text-fg-muted">
            <KeyRound className="size-3.5" aria-hidden />
            {t('keyCount', { n: org.active_keys })}
          </span>
        </span>

        {quota > 0 ? (
          <span className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-[11px] text-fg-muted">
              <span>{t('usage', { used: formatRequests(used), quota: formatRequests(quota) })}</span>
              <span className={tight ? 'font-semibold text-status-bad' : undefined}>{share}</span>
            </span>
            {/* A plain bar: the only question is how close to the ceiling they are. It keeps a
                sliver of width once anything has been spent, so a real figure never looks like
                an empty track. */}
            <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
              <span
                className={`block h-full rounded-full transition-[width] duration-500 ${tight ? 'bg-status-bad' : 'bg-primary'}`}
                style={{ width: barWidth(used, quota) }}
              />
            </span>
          </span>
        ) : (
          <span className="text-[11px] text-fg-subtle">{t('noApiTier')}</span>
        )}
      </button>
    </li>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations('organizations')
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <Building2 className="size-6 text-fg-subtle" aria-hidden />
      <p className="text-sm font-medium">{t('empty')}</p>
      <p className="max-w-sm text-xs text-fg-muted">{t('emptyHint')}</p>
      {/* An empty state that only describes the gap leaves the reader to find the control. */}
      <Button type="button" size="sm" className="mt-1" onClick={onAdd}>
        <Plus className="size-3.5" aria-hidden />
        {t('addTitle')}
      </Button>
    </div>
  )
}

function NewAccount({ onDone }: { onDone: () => void }) {
  const t = useTranslations('organizations')
  const create = useCreateOrganization()
  const [name, setName] = useState('')
  const [stakeholder, setStakeholder] = useState<string>('cooperative')

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-surface-sunken/40 p-3">
      <p className="text-xs text-fg-muted">{t('addDesc')}</p>
      <form
        aria-label={t('addTitle')}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { name, stakeholder: stakeholder as OrganizationOut['stakeholder'] },
            {
              onSuccess: () => {
                setName('')
                onDone()
              },
            },
          )
        }}
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs">
          <span className="text-fg-muted">{t('name')}</span>
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-fg-muted">{t('tier')}</span>
          <select
            value={stakeholder}
            onChange={(e) => setStakeholder(e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1.5"
          >
            {STAKEHOLDERS.map((key) => (
              <option key={key} value={key}>
                {t(`stakeholder.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? t('adding') : t('add')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t('cancel')}
        </Button>
      </form>
      {create.isError && (
        <p role="alert" className="text-xs text-status-bad">
          {(create.error as Error).message}
        </p>
      )}
    </div>
  )
}

function Credentials({ organizationId }: { organizationId: string }) {
  const t = useTranslations('organizations')
  const format = useFormatter()
  const keys = useOrganizationKeys(organizationId)
  const usage = useOrganizationUsage(organizationId)
  const issue = useIssueKey(organizationId)
  const revoke = useRevokeKey(organizationId)
  const [label, setLabel] = useState('')
  const [justIssued, setJustIssued] = useState<ApiKeyIssued | null>(null)

  return (
    <Card className="p-3.5 sm:p-5">
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <Plug />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('keys')}</CardTitle>
            <CardDescription>
              {usage.data
                ? t('usageMonth', {
                    used: usage.data.used_this_month.toLocaleString(),
                    quota: usage.data.quota_monthly.toLocaleString(),
                    month: usage.data.month,
                  })
                : t('keysDesc')}
            </CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {justIssued && <IssuedKey issued={justIssued} onDismiss={() => setJustIssued(null)} />}

        <form
          aria-label={t('issue')}
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            issue.mutate(label, {
              onSuccess: (data) => {
                setJustIssued(data)
                setLabel('')
              },
            })
          }}
        >
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
            <span className="text-fg-muted">{t('keyLabel')}</span>
            <input
              required
              minLength={2}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('keyLabelHint')}
              className="rounded-md border border-border bg-surface px-2 py-1.5"
            />
          </label>
          <Button type="submit" size="sm" disabled={issue.isPending}>
            {issue.isPending ? t('issuing') : t('issue')}
          </Button>
        </form>
        {issue.isError && (
          <p role="alert" className="text-xs text-status-bad">
            {(issue.error as Error).message}
          </p>
        )}

        {keys.isPending ? (
          <Skeleton className="h-20" />
        ) : keys.data?.length ? (
          <ul className="flex flex-col gap-1.5 text-xs">
            {keys.data.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <code className="rounded bg-surface-sunken px-1.5 py-0.5">…{key.last_four}</code>
                  <span className="truncate font-medium">{key.label}</span>
                  {!key.is_active && <Badge>{t('revoked')}</Badge>}
                </span>
                <span className="flex items-center gap-2 text-fg-subtle">
                  <span>
                    {key.last_used_at
                      ? t('lastUsed', { date: format.dateTime(new Date(key.last_used_at), 'date') })
                      : t('neverUsed')}
                  </span>
                  {key.is_active && (
                    <button
                      type="button"
                      onClick={() => revoke.mutate(key.id)}
                      className="min-h-9 rounded px-1.5 text-status-bad hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t('revoke')}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-fg-muted">
            {t('noKeys')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function IssuedKey({ issued, onDismiss }: { issued: ApiKeyIssued; onDismiss: () => void }) {
  const t = useTranslations('organizations')
  const [copied, setCopied] = useState(false)
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-primary bg-surface-sunken p-3">
      <p className="text-xs font-semibold">{t('issuedOnce')}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-surface px-2 py-1.5 text-xs">
          {issued.key}
        </code>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(issued.key)
            setCopied(true)
          }}
        >
          <Copy className="size-3.5" aria-hidden />
          {copied ? t('copied') : t('copy')}
        </Button>
      </div>
      <p className="text-[11px] text-fg-muted">{t('issuedHint')}</p>
      <Button type="button" size="sm" variant="ghost" className="self-start" onClick={onDismiss}>
        {t('dismiss')}
      </Button>
    </div>
  )
}
