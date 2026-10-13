'use client'

import { useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query currently matches.
 *
 * Layout is CSS's job and stays in CSS. This exists for the handful of decisions CSS cannot
 * express — chiefly `inert`, which is an attribute rather than a style, so an off-canvas drawer
 * cannot be taken out of the tab order by a class alone.
 *
 * `matchMedia` is absent in jsdom and in some embedded webviews, so the server snapshot and the
 * fallback are both `false`. Callers must therefore treat `false` as "assume the small layout",
 * which is the safe direction: a drawer is interactive when open and inert otherwise.
 */
function query(media: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(media)
    : null
}

export function useMediaQuery(media: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = query(media)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    () => query(media)?.matches ?? false,
    () => false,
  )
}

/** The `lg` breakpoint, where the sidebar stops being a drawer and becomes a fixed column. */
export const DESKTOP_NAV = '(min-width: 64rem)'
