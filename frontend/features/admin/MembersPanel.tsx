'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, KeyRound, UserPlus } from 'lucide-react'
import type { CredentialLink, InviteMember, MemberOut } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api/client'

const EMPTY: InviteMember = { full_name: '', email: '', role: 'agent' }

/**
 * Who can actually sign in for an account, and how to give somebody that ability.
 *
 * An organisation created straight from this page — rather than through an access request — has
 * no user at all. It appears in the list, shows a quota, and nobody on earth can open it. This
 * panel is where that gets fixed, and where the state is visible before somebody asks.
 *
 * No password is ever set here. The administrator receives a one-time link and the person chooses
 * their own, because an administrator who could set it could then sign in as them and nothing
 * downstream could tell the two apart.
 */
export function MembersPanel({ orgId, orgName }: { orgId: string; orgName: string }) {
  const t = useTranslations('members')
  const format = useFormatter()
  const qc = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [form, setForm] = useState<InviteMember>(EMPTY)
  const [link, setLink] = useState<CredentialLink | null>(null)

  const members = useQuery({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: () => api.members(orgId),
    staleTime: 30_000,
    retry: false,
  })

  const invite = useMutation({
    mutationFn: (req: InviteMember) => api.inviteMember(orgId, req),
    onSuccess: (created) => {
      setLink(created)
      setInviting(false)
      setForm(EMPTY)
      void qc.invalidateQueries({ queryKey: ['organizations'] })
    },
  })

  const reset = useMutation({
    mutationFn: (userId: string) => api.resetPassword(userId),
    onSuccess: setLink,
  })

  const rows = members.data ?? []

  return (
    <div className="flex flex-col gap-2.5 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold tracking-wider text-fg-muted uppercase">
          {t('title')}
        </h4>
        <Button size="sm" variant="ghost" onClick={() => setInviting((v) => !v)}>
          <UserPlus className="size-3.5" aria-hidden />
          {t('invite')}
        </Button>
      </div>

      {members.isError ? (
        <QueryError error={members.error} onRetry={() => void members.refetch()} />
      ) : members.isPending ? (
        <Skeleton className="h-10" />
      ) : rows.length ? (
        <ul className="flex flex-col gap-1.5">
          {rows.map((member: MemberOut) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{member.full_name}</span>
                <span className="truncate text-xs text-fg-subtle">
                  {member.email} · {member.role}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {/* Invited is not the same as arrived, and only one of them is a way in. */}
                {!member.has_signed_in && (
                  <Badge>{member.invitation_pending ? t('invited') : t('neverIn')}</Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={reset.isPending}
                  onClick={() => reset.mutate(member.id)}
                >
                  <KeyRound className="size-3.5" aria-hidden />
                  {t('reset')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        // The state the whole panel exists for: an account nobody can open.
        <p className="rounded-lg border border-dashed border-status-warn/50 bg-status-warn/5 px-3 py-2.5 text-xs leading-relaxed">
          {t('nobody', { name: orgName })}
        </p>
      )}

      {inviting && (
        <form
          aria-label={t('invite')}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            invite.mutate(form)
          }}
        >
          <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs">
            <span className="text-fg-muted">{t('theirName')}</span>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              className="rounded-md border border-border bg-surface px-2 py-1.5"
            />
          </label>
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
            <span className="text-fg-muted">{t('theirEmail')}</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="rounded-md border border-border bg-surface px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-fg-muted">{t('theirRole')}</span>
            <select
              value={form.role ?? 'agent'}
              onChange={(e) => setForm({ ...form, role: e.target.value as InviteMember['role'] })}
              className="rounded-md border border-border bg-surface px-2 py-1.5"
            >
              <option value="agent">{t('roleAgent')}</option>
              <option value="minister">{t('roleMinister')}</option>
            </select>
          </label>
          <Button type="submit" size="sm" disabled={invite.isPending}>
            {t('sendInvite')}
          </Button>
          <p className="w-full text-[11px] text-fg-subtle">{t('noPasswordHere')}</p>
        </form>
      )}

      {link && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-lg border border-primary bg-surface-sunken p-3"
        >
          <p className="text-xs font-semibold">{t('linkOnce', { name: link.full_name })}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-surface px-2 py-1.5 text-xs">
              {`${window.location.origin}/invite/${link.token}`}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void navigator.clipboard?.writeText(`${window.location.origin}/invite/${link.token}`)
              }
            >
              <Copy className="size-3.5" aria-hidden />
              {t('copy')}
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-fg-muted">{link.instruction}</p>
          <p className="text-[11px] text-fg-subtle">
            {t('expires', { date: format.dateTime(new Date(link.expires_at), 'date') })}
          </p>
          <Button size="sm" variant="ghost" className="self-start" onClick={() => setLink(null)}>
            {t('dismiss')}
          </Button>
        </div>
      )}

      {(invite.isError || reset.isError) && (
        <p role="alert" className="text-xs text-status-bad">
          {((invite.error ?? reset.error) as Error).message}
        </p>
      )}
    </div>
  )
}
