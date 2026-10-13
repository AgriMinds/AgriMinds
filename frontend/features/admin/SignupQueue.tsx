'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserCheck } from 'lucide-react'
import type { ApprovalDecision, PendingUser } from '@agriminds/api-types'
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
      </CardHeader>
      <CardContent>
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
