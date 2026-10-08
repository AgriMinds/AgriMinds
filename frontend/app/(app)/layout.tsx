import { redirect } from 'next/navigation'
import { Shell } from '@/components/layout/Shell'
import { LOGIN_PATH } from '@/lib/auth/routing'
import { getSession } from '@/lib/server/session'

/**
 * Guards the application shell. This is defence in depth behind `proxy.ts`; the real
 * authorisation happens in the API, which verifies the access token on every call.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect(LOGIN_PATH)
  return (
    <Shell user={{ name: session.user.name, role: session.user.role }}>{children}</Shell>
  )
}
