'use client'

import { useEffect, useState } from 'react'

/** Roughly the sticky top bar: a section counts as current once it reaches this line. */
const BAND_TOP = 96

/**
 * Which of the given section ids the reader is currently on.
 *
 * Used for the farmer's in-page navigation. Three things make this less trivial than it looks.
 *
 * The sections belong to a page that renders once its data arrives, so when this hook first runs
 * the elements usually do not exist yet. Looking them up only on mount silently observes nothing
 * and freezes the highlight on the first section, so the document is watched until each id turns
 * up.
 *
 * At the top of the page the reader is in the header, above every section, so the first section
 * is shown rather than whatever was last current — otherwise scrolling back up leaves the
 * highlight stranded further down the list.
 *
 * At the bottom the last section can never reach the line, however far the reader scrolls, so it
 * is treated as current once the page has nothing left to scroll. Without that, tapping the last
 * link highlights the one before it.
 */
export function useActiveSection(ids: readonly string[], initial?: string): string | null {
  const [active, setActive] = useState<string | null>(initial ?? ids[0] ?? null)
  const key = ids.join('|')

  useEffect(() => {
    const sections = key.split('|').filter(Boolean)
    if (typeof document === 'undefined' || !sections.length) return

    const pick = (): string | null => {
      const found = sections
        .map((id) => ({ id, element: document.getElementById(id) }))
        .filter((entry): entry is { id: string; element: HTMLElement } => entry.element !== null)
      if (!found.length) return null

      const doc = document.documentElement
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 2) return found[found.length - 1]!.id

      let current = found[0]!.id
      for (const { id, element } of found) {
        if (element.getBoundingClientRect().top <= BAND_TOP) current = id
      }
      return current
    }

    let frame = 0
    let scheduled = false
    const update = () => {
      const next = pick()
      if (next) setActive(next)
    }
    // The guard is its own flag rather than the frame handle: the handle is only assigned after
    // requestAnimationFrame returns, which is too late if the callback already ran.
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      frame = requestAnimationFrame(() => {
        scheduled = false
        update()
      })
    }

    // The sections arrive with the page's data; stop watching once they are all present.
    let mutations: MutationObserver | undefined
    const present = () => sections.every((id) => document.getElementById(id))
    if (!present() && typeof MutationObserver !== 'undefined') {
      mutations = new MutationObserver(() => {
        schedule()
        if (present()) mutations?.disconnect()
      })
      mutations.observe(document.body, { childList: true, subtree: true })
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      mutations?.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [key])

  return active
}
