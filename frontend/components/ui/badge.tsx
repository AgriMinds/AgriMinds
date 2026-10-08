import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap [&_svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/12 text-primary',
        outline: 'border-border bg-surface-raised text-fg-muted',
        accent: 'border-transparent bg-accent text-accent-fg',
        ok: 'border-transparent bg-status-ok/15 text-status-ok',
        warn: 'border-transparent bg-status-warn/20 text-fg',
        bad: 'border-transparent bg-status-bad/12 text-status-bad',
        low: 'border-transparent bg-risk-low text-risk-low-fg',
        moderate: 'border-transparent bg-risk-moderate text-risk-moderate-fg',
        high: 'border-transparent bg-risk-high text-risk-high-fg',
        severe: 'border-transparent bg-risk-severe text-risk-severe-fg',
      },
      size: { sm: 'px-2 py-0 text-[10px]', md: '', lg: 'px-3 py-1 text-xs' },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

export { Badge, badgeVariants }
