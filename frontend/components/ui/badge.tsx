import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap [&_svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/15 text-primary',
        outline: 'border-border bg-surface-raised text-fg-muted',
        accent: 'border-transparent bg-accent text-accent-fg',
        ok: 'border-transparent bg-status-ok/15 text-status-ok',
        warn: 'border-transparent bg-status-warn/20 text-fg',
        bad: 'border-transparent bg-status-bad/15 text-status-bad',
        low: 'border-transparent bg-risk-low-soft text-fg',
        moderate: 'border-transparent bg-risk-moderate-soft text-fg',
        high: 'border-transparent bg-risk-high-soft text-fg',
        severe: 'border-transparent bg-risk-severe-soft text-fg',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
