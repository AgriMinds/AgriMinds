'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-black">Something went wrong</h1>
      <p className="text-sm text-fg-muted">The page failed to render. Reload or try again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  )
}
