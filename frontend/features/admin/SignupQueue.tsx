'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, KeyRound, UserCheck, UserPlus } from 'lucide-react'
import type {
  ApprovalDecision,
  CredentialLink,
  PendingUser,
  RegisterFarmer,
} from '@agriminds/api-types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardIcon,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api/client'

/**
 * Who signed themselves up and is waiting to be let in.
 *
 * Oldest first, because the person kept waiting longest is the one being failed. The note is shown
 * in full rather than truncated: it is the only thing an agent has to check a claimed holding
 * against, and a decision made on half of it is not a check.
 */
export function SignupQueue() {
  const t = useTranslations('signups')
  const format = useFormatter()
  const qc = useQueryClient()
  const [refusing, setRefusing] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [registering, setRegistering] = useState(false)
  const EMPTY: RegisterFarmer = { full_name: '', phone: '', locale: 'en' }
  const [applicant, setApplicant] = useState<RegisterFarmer>(EMPTY)
  const [link, setLink] = useState<CredentialLink | null>(null)

  const queue = useQuery({
    queryKey: ['staff', 'signups'],
    queryFn: api.pendingSignups,
    staleTime: 30_000,
    retry: false,
  })

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ApprovalDecision }) =>
      api.decideSignup(id, decision),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff', 'signups'] })
      setRefusing(null)
      setNote('')
    },
  })

  const register = useMutation({
    mutationFn: (req: RegisterFarmer) => api.registerFarmer(req),
    onSuccess: (created) => {
      setLink(created)
      setRegistering(false)
      setApplicant(EMPTY)
      void qc.invalidateQueries({ queryKey: ['staff', 'signups'] })
    },
  })

  const rows = queue.data ?? []

  return (
    <Card className="p-3.5 sm:p-5">
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <UserCheck />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('desc')}</CardDescription>
          </div>
        </CardHeading>
        <Button size="sm" variant="ghost" onClick={() => setRegistering((v) => !v)}>
          <UserPlus className="size-3.5" aria-hidden />
          {t('registerInPerson')}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* The farmer who walks into the office: the case the hotline points at. */}
        {registering && (
          <form
            aria-label={t('registerInPerson')}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault()
              register.mutate(applicant)
            }}
          >
            <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs">
              <span className="text-fg-muted">{t('theirName')}</span>
              <input
                value={applicant.full_name}
                onChange={(e) => setApplicant({ ...applicant, full_name: e.target.value })}
                required
                className="rounded-md border border-border bg-surface px-2 py-1.5"
              />
            </label>
            <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs">
              <span className="text-fg-muted">{t('theirPhone')}</span>
              <input
                value={applicant.phone}
                onChange={(e) => setApplicant({ ...applicant, phone: e.target.value })}
                required
                inputMode="tel"
                placeholder="0912345678"
                className="rounded-md border border-border bg-surface px-2 py-1.5"
              />
            </label>
            <Button type="submit" size="sm" disabled={register.isPending}>
              {t('createAndLink')}
            </Button>
            {/* Stated on the form: the agent is not choosing anybody's password. */}
            <p className="w-full text-[11px] text-fg-subtle">{t('noPasswordHere')}</p>
          </form>
        )}

        {link && <OneTimeLink link={link} onDismiss={() => setLink(null)} />}

        {register.isError && (
          <p role="alert" className="text-xs text-status-bad">
            {(register.error as Error).message}
          </p>
        )}

        {queue.isError ? (
          <QueryError
            error={queue.error}
            onRetry={() => void queue.refetch()}
            isRetrying={queue.isFetching}
          />
        ) : queue.isPending ? (
          <Skeleton className="h-24" />
        ) : rows.length ? (
          <ul className="flex flex-col gap-2">
            {rows.map((person: PendingUser) => (
              <li key={person.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold">{person.full_name}</span>
                    <span className="text-xs text-fg-subtle">
                      <a href={`tel:${person.phone}`} className="underline">
                        {person.phone}
                      </a>
                      {person.woreda_name && ` · ${person.woreda_name}`}
                      {` · ${t('waitingSince', {
                        date: format.dateTime(new Date(person.signed_up_at), 'date'),
                      })}`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: person.id, decision: { approve: true } })}
                    >
                      {t('approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={decide.isPending}
                      onClick={() => setRefusing(refusing === person.id ? null : person.id)}
                    >
                      {t('refuse')}
                    </Button>
                  </div>
                </div>

                {/* Shown whole: it is the only evidence behind the decision. */}
                {person.note && (
                  <p className="rounded-md bg-surface-sunken/60 px-2.5 py-2 text-xs leading-relaxed">
                    {person.note}
                  </p>
                )}

                {refusing === person.id && (
                  <form
                    aria-label={t('refuse')}
                    className="flex flex-wrap items-end gap-2 border-t border-border pt-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      decide.mutate({
                        id: person.id,
                        decision: { approve: false, note: note || null },
                      })
                    }}
                  >
                    <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
                      <span className="text-fg-muted">{t('why')}</span>
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="rounded-md border border-border bg-surface px-2 py-1.5"
                      />
                    </label>
                    <Button type="submit" size="sm" variant="ghost" disabled={decide.isPending}>
                      {t('confirmRefusal')}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-fg-muted">
            {t('empty')}
          </p>
        )}
        {decide.isError && (
          <p role="alert" className="mt-2 text-xs text-status-bad">
            {(decide.error as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}


/**
 * A link that is shown once and never again.
 *
 * Only its hash is stored, so this is the single moment it exists in readable form. The staff
 * member hands it over, reads it down the phone, or writes it on a slip — there is no mail server
 * and no SMS carrier to do it for them, which is exactly why it expires and works once.
 */
function OneTimeLink({ link, onDismiss }: { link: CredentialLink; onDismiss: () => void }) {
  const t = useTranslations('signups')
  const format = useFormatter()
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/invite/${link.token}`

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-primary bg-surface-sunken p-3"
    >
      <p className="flex items-center gap-2 text-xs font-semibold">
        <KeyRound className="size-3.5 text-primary" aria-hidden />
        {t('linkFor', { name: link.full_name })}
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-surface px-2 py-1.5 text-xs">
          {url}
        </code>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(url)
            setCopied(true)
          }}
        >
          <Copy className="size-3.5" aria-hidden />
          {copied ? t('copied') : t('copy')}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-fg-muted">{link.instruction}</p>
      <p className="text-[11px] text-fg-subtle">
        {t('linkExpires', { date: format.dateTime(new Date(link.expires_at), 'date') })}
      </p>
      <Button type="button" size="sm" variant="ghost" className="self-start" onClick={onDismiss}>
        {t('dismiss')}
      </Button>
    </div>
  )
}
