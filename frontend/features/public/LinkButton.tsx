import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  href: string
  children: React.ReactNode
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'lg'
  className?: string
}

/**
 * A link styled as a button.
 *
 * The `Button` in this codebase is a plain `<button>` with no `asChild`, and a call to action that
 * navigates must be an anchor: it has to be openable in a new tab and readable by a crawler, which
 * a button with an onClick is not. Reusing `buttonVariants` keeps the two visually identical
 * without introducing a second button implementation.
 */
export function LinkButton({ href, children, variant = 'default', size, className }: Props) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  )
}
