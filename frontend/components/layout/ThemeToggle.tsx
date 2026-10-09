'use client'

import { useCallback } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useIsDark } from '@/hooks/useIsDark'

const KEY = 'agriminds-theme'

export function ThemeToggle() {
  const t = useTranslations('app.theme')
  const isDark = useIsDark()

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
