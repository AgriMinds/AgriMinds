'use client'

import { useEffect, useState } from 'react'

/** Scroll-spy: returns the id of the section currently closest to the top of the viewport. */
export function useActiveSection<T extends string>(ids: readonly T[], initial: T): T {
  const [active, setActive] = useState<T>(initial)
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null)
    if (!els.length) return
    const visible = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0)
        let best: T | null = null
        let bestRatio = 0
        for (const id of ids) {
          const r = visible.get(id) ?? 0
          if (r > bestRatio) {
            best = id
            bestRatio = r
          }
        }
        if (best) setActive(best)
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0, 0.2, 0.5, 1] },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [ids])
  return active
}
