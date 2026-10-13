import { cn } from '@/lib/utils'

/** A page band with the one horizontal rhythm every public page uses. */
export function Section({
  children,
  tone = 'plain',
  className,
}: {
  children: React.ReactNode
  tone?: 'plain' | 'sunken'
  className?: string
}) {
  return (
    <section className={cn(tone === 'sunken' && 'border-y border-border bg-surface-sunken')}>
      <div
        className={cn(
          'mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-14 sm:px-6 lg:px-8 lg:py-20',
          className,
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function SectionHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string
  title: string
  lead?: string
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-2.5">
      <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{eyebrow}</span>
      <h2 className="font-display text-display-sm font-bold tracking-tight text-balance">{title}</h2>
      {lead && <p className="text-sm leading-relaxed text-fg-muted sm:text-base">{lead}</p>}
    </div>
  )
}

/**
 * Reveals its children as they scroll into view, using the CSS scroll-driven animation in
 * `globals.css`.
 *
 * No animation library: one keyframe and `animation-timeline: view()` do this natively, and a
 * dependency that ships a runtime to every visitor is a poor trade for a fade. Browsers without
 * scroll-driven animations simply render the content, and the whole effect is disabled under
 * `prefers-reduced-motion`.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'li'
}) {
  return (
    <Tag className={cn('reveal', className)} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  )
}
