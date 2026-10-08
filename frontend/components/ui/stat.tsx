import * as React from 'react'
import { CardIcon } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Props = {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  /** Optional slot under the value (range bar, badge…). */
  children?: React.ReactNode
  tone?: string
  loading?: boolean
  className?: string
  /** Renders the tile as a button (e.g. "jump to highest-risk cell"). */
  onClick?: () => void
  'aria-label'?: string
}

/** KPI tile. Big display numeral, one-line label above, one-line detail below. */
export function Stat({ icon, label, value, detail, children, tone, loading, className, onClick, ...rest }: Props) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={rest['aria-label']}
      className={cn(
        'group relative flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface-raised p-4 text-left shadow-sm sm:p-5',
        onClick &&
          'cursor-pointer transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <CardIcon className={cn('size-8 rounded-lg [&_svg]:size-4', tone)}>{icon}</CardIcon>
        <span className="truncate text-xs font-medium text-fg-muted">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-28" />
      ) : (
        <div className="font-display text-stat font-bold tracking-tight tabular">{value}</div>
      )}
      {children}
      {detail && <div className="text-xs leading-snug text-fg-subtle">{detail}</div>}
    </Tag>
  )
}
