import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { homePathFor } from '@agriminds/api-types'
import { SignupForm } from '@/features/auth/SignupForm'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signup')
  return { title: t('title'), description: t('lead') }
}

/** The farmer's own door in. Institutions use the access request instead. */
export default async function SignupPage() {
  const session = await getSession()
  if (session) redirect(homePathFor(session.user.role))

  const t = await getTranslations('signup')
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
            <p className="text-sm text-fg-muted">{t('lead')}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface-raised p-5 shadow-md sm:p-7">
          <h2 className="mb-5 font-display text-lg font-semibold">{t('title')}</h2>
          <SignupForm />
        </div>

        <div className="mt-6 flex flex-col items-center gap-1 text-center text-xs text-fg-subtle">
          <Link href="/login" className="underline hover:text-fg">
            {t('haveAccount')}
          </Link>
          {/* An institution is not a farmer and should not land in the farmer queue. */}
          <Link href="/request-access" className="underline hover:text-fg">
            {t('institution')}
          </Link>
        </div>
      </div>
    </main>
  )
}
