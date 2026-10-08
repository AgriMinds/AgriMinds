import { redirect } from 'next/navigation'
import { homePathFor } from '@agriminds/api-types'
import { LOGIN_PATH } from '@/lib/auth/routing'
import { getSession } from '@/lib/server/session'

/** The entry point only decides where a visitor belongs. */
export default async function RootPage() {
  const session = await getSession()
  redirect(session ? homePathFor(session.user.role) : LOGIN_PATH)
}
