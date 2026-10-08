'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type SegmentedOption<T extends string | number> = {
  value: T
  label: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  /** Visual tone when selected. */
  tone?: 'primary' | 'accent' | 'bad' | 'neutral'
}

type Props<T extends string | number> = {
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  'aria-label': string
  size?: 'sm' | 'md' | 'lg'
  /** `pill`: one compact row. `tile`: equal-width tiles with hint text. */
  variant?: 'pill' | 'tile'
  className?: string
}

const SELECTED: Record<NonNullable<SegmentedOption<string>['tone']>, string> = {
  primary: 'bg-primary text-primary-fg shadow-sm',
  accent: 'bg-accent text-accent-fg shadow-sm',
  bad: 'bg-status-bad text-white shadow-sm',
  neutral: 'bg-fg text-surface shadow-sm',
}

/**
 * Mutually-exclusive choice rendered as a radio group with roving focus:
 * Tab lands on the selected item, arrow keys move the selection.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  variant = 'pill',
  className,
  ...rest
}: Props<T>) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (index + delta + options.length) % options.length
    onChange(options[next]!.value)
    refs.current[next]?.focus()
  }

  const sizes = { sm: 'min-h-8 px-2.5 text-xs', md: 'min-h-10 px-3.5 text-sm', lg: 'min-h-11 px-4 text-sm' }[size]

  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className={cn(
        variant === 'pill'
          ? 'inline-flex items-center gap-1 rounded-xl border border-border bg-surface-sunken p-1'
          : 'grid gap-2',
        variant === 'tile' && `grid-cols-${options.length}`,
        className,
      )}
      style={variant === 'tile' ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value
        const tone = opt.tone ?? 'primary'
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-sunken',
              variant === 'pill' && sizes,
              variant === 'pill' && (selected ? SELECTED[tone] : 'text-fg-muted hover:bg-surface-raised hover:text-fg'),
              variant === 'tile' &&
                'min-h-16 flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left text-sm',
              variant === 'tile' &&
                (selected
                  ? cn(
                      'border-transparent',
                      tone === 'bad' && 'bg-status-bad/12 text-fg ring-2 ring-status-bad',
                      tone === 'neutral' && 'bg-surface-sunken text-fg ring-2 ring-fg/60',
                      (tone === 'primary' || tone === 'accent') && 'bg-primary/10 text-fg ring-2 ring-primary',
                    )
                  : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:bg-surface-sunken/60 hover:text-fg'),
            )}
          >
            {variant === 'tile' ? (
              <>
                <span className="flex items-center gap-1.5 font-semibold [&_svg]:size-4">
                  {opt.icon}
                  {opt.label}
                </span>
                {opt.hint && <span className="text-[11px] font-normal leading-snug text-fg-subtle">{opt.hint}</span>}
              </>
            ) : (
              <>
                {opt.icon && <span className="[&_svg]:size-4">{opt.icon}</span>}
                {opt.label}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
