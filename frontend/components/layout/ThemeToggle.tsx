'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

const KEY = 'agriminds-theme'

/** The <html> class list is the source of truth (set before paint by the inline script in layout.tsx). */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    mq.removeEventListener('change', onChange)
  }
}

function getSnapshot(): boolean {
  const root = document.documentElement
  if (root.classList.contains('dark')) return true
  if (root.classList.contains('light')) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeToggle() {
  const t = useTranslations('app.theme')
  const isDark = useSyncExternalStore(subscribe, getSnapshot, () => false)

  const toggle = useCallback(() => {
    const next = !isDark
    const root = document.documentElement
    root.classList.toggle('dark', next)
    root.classList.toggle('light', !next)
    try {
      window.localStorage.setItem(KEY, next ? 'dark' : 'light')
    } catch {
      /* storage unavailable (private mode): theme still applies for this page */
    }
  }, [isDark])

  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={isDark ? t('toLight') : t('toDark')}
      aria-pressed={isDark}
      onClick={toggle}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
