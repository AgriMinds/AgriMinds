import Image from 'next/image'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { homePathFor } from '@agriminds/api-types'
import { LoginForm } from '@/features/auth/LoginForm'
import { safeNextPath } from '@/lib/auth/routing'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: t('signIn') }
}

const DEMO = [
  { who: 'ministry', id: 'minister@moa.gov.et' },
  { who: 'agent', id: 'agent.sinan@moa.gov.et' },
  { who: 'farmer', id: '0912000001' },
] as const

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await getSession()
  const { next } = await searchParams
  if (session) redirect(safeNextPath(next) ?? homePathFor(session.user.role))

  const t = await getTranslations('auth')
  const ta = await getTranslations('app')
  const showDemo = process.env.NODE_ENV !== 'production'

  return (
    <main id="main" className="bg-contour flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center overflow-hidden rounded-2xl shadow-md">
            <Image src="/icon.png" alt="AgriMinds" width={56} height={56} className="size-14 object-cover" />
          </span>
          <div>
            <h1 className="font-display text-display-sm font-bold tracking-tight">{ta('name')}</h1>
            <p className="text-sm text-fg-muted">{t('subtitle')}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface-raised p-5 shadow-md sm:p-7">
          <h2 className="mb-5 font-display text-lg font-semibold">{t('title')}</h2>
          <LoginForm next={next} />
        </div>

        {showDemo && (
          <div className="mt-5 rounded-xl border border-dashed border-border-strong bg-surface-raised/60 p-4">
            <p className="text-xs font-semibold tracking-wider text-fg-muted uppercase">{t('demoTitle')}</p>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-fg-muted">
              {DEMO.map((d) => (
                <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>{t(`demoRole.${d.who}`)}</span>
                  <code className="font-mono text-[11px] text-fg">{d.id}</code>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-mono text-[11px] text-fg-subtle">{t('demoPassword')}: AgriMinds#2026</p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-fg-subtle">{ta('workspaceSub')}</p>
      </div>
    </main>
  )
}
