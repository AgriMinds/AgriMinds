import Image from 'next/image'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { homePathFor } from '@agriminds/api-types'
import { AcceptInvitationForm } from '@/features/auth/AcceptInvitationForm'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: t('invite.title') }
}

/**
 * Where an approved organisation's contact chooses their password and lands in the product.
 *
 * Whether the token is still good is only known upstream, and asking here would spend a check on
 * every page view and tell a guesser which tokens exist. So the page always renders the form and
 * the answer comes from the one submission that matters.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const session = await getSession()
  // Already signed in: accepting would swap this browser onto another account by surprise.
  if (session) redirect(homePathFor(session.user.role))

  const { token } = await params
  const t = await getTranslations('auth')
  const ta = await getTranslations('app')

  return (
    <main id="main" className="bg-contour flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center overflow-hidden rounded-2xl shadow-md">
            <Image src="/icon.png" alt="AgriMinds" width={56} height={56} className="size-14 object-cover" />
          </span>
          <div>
            <h1 className="font-display text-display-sm font-bold tracking-tight">{ta('name')}</h1>
            <p className="text-sm text-fg-muted">{t('invite.subtitle')}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface-raised p-5 shadow-md sm:p-7">
          <h2 className="mb-1 font-display text-lg font-semibold">{t('invite.title')}</h2>
          <p className="mb-5 text-sm text-fg-muted">{t('invite.lead')}</p>
          <AcceptInvitationForm token={token} />
        </div>

        <p className="mt-6 text-center text-xs text-fg-subtle">{ta('workspaceSub')}</p>
      </div>
    </main>
  )
}
