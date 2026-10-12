'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Numbered section head, after the poster this page is modelled on.
 *
 * The number is decorative for a screen reader — the heading text already carries the
 * structure — so it is hidden from the accessibility tree rather than read as "1 ENSO driver".
 */
export function SectionBanner({
  index,
  title,
  tone = 'navy',
  action,
}: {
  index: number
  title: string
  tone?: 'navy' | 'red' | 'green' | 'violet' | 'teal'
  action?: ReactNode
}) {
  const tones = {
    navy: 'bg-surface-inverse text-white',
    red: 'bg-risk-severe text-white',
    green: 'bg-primary text-primary-fg',
    violet: 'bg-[oklch(0.45_0.13_300)] text-white',
    teal: 'bg-[oklch(0.42_0.09_205)] text-white',
  }[tone]
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-xl px-3.5 py-2 sm:px-4', tones)}>
      <h2 className="flex min-w-0 items-start gap-2 font-display text-[13px] leading-snug font-bold tracking-wide uppercase sm:items-center sm:gap-2.5 sm:text-sm lg:text-base">
        <span className="shrink-0 opacity-70 tabular-nums" aria-hidden>
          {index}.
        </span>
        <span className="min-w-0">{title}</span>
      </h2>
      {action}
    </div>
  )
}
