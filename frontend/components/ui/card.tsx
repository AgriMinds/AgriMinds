import * as React from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="card"
      className={cn(
        'flex flex-col gap-5 rounded-2xl border border-border bg-surface-raised p-4 text-fg shadow-sm sm:p-6',
        className,
      )}
      {...props}
    />
  )
}

/** Header row: icon + (title, description) on the left, optional actions on the right. */
function CardHeader({ className, ...props }: React.ComponentProps<'header'>) {
  return (
    <header
      data-slot="card-header"
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6', className)}
      {...props}
    />
  )
}

function CardHeading({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-heading" className={cn('flex min-w-0 items-start gap-3', className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="card-title"
      className={cn('font-display text-base font-semibold leading-tight tracking-tight sm:text-lg', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p data-slot="card-description" className={cn('mt-1 text-xs leading-relaxed text-fg-muted sm:text-sm', className)} {...props} />
  )
}

function CardActions({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-actions" className={cn('flex shrink-0 items-center gap-2', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('flex flex-col gap-4', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-fg-muted', className)}
      {...props}
    />
  )
}

/** Icon tile used in card headers, stat tiles and directives. */
function CardIcon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary [&_svg]:size-[18px]',
        className,
      )}
      aria-hidden
    >
      {children}
    </div>
  )
}

export { Card, CardHeader, CardHeading, CardTitle, CardDescription, CardActions, CardContent, CardFooter, CardIcon }
