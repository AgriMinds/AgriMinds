'use client'

import { useEffect, useState } from 'react'

/**
 * Which of the given section ids is currently in view.
 *
 * Used for the farmer's in-page navigation. The root margin biases towards the section nearest
 * the top of the viewport rather than whichever happens to be largest, so the highlight tracks
 * where the reader is rather than jumping to a tall section further down.
 */
export function useActiveSection(ids: readonly string[], initial?: string): string | null {
  const [active, setActive] = useState<string | null>(initial ?? ids[0] ?? null)
  const key = ids.join('|')

  useEffect(() => {
    const sections = key.split('|').filter(Boolean)
    if (typeof IntersectionObserver === 'undefined' || !sections.length) return

    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        let best: string | null = null
        let bestRatio = 0
        for (const id of sections) {
          const ratio = visible.get(id) ?? 0
          if (ratio > bestRatio) {
            best = id
            bestRatio = ratio
          }
        }
        if (best) setActive(best)
      },
      { rootMargin: '-80px 0px -45% 0px', threshold: [0, 0.25, 0.6, 1] },
    )

    const observed = sections
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    observed.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [key])

  return active
}
