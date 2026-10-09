'use client'

import { useSyncExternalStore } from 'react'

/**
 * Whether the app is currently rendering dark.
 *
 * The `<html>` class list is the source of truth, set before paint by the inline script in
 * layout.tsx so there is no flash. When neither class is present the viewer has expressed no
 * preference and the system setting decides, which is why the media query is watched too.
 *
 * Shared rather than local to the toggle because an embedded frame has to be told the theme
 * explicitly — it cannot inherit the page's CSS — and a frame that disagreed with the page
 * would be a white rectangle in a dark room.
 */
/** Absent in jsdom and in a few embedded webviews; an explicit class still works without it. */
function colourSchemeQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  const query = colourSchemeQuery()
  query?.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    query?.removeEventListener('change', onChange)
  }
}

function getSnapshot(): boolean {
  const root = document.documentElement
  if (root.classList.contains('dark')) return true
  if (root.classList.contains('light')) return false
  return colourSchemeQuery()?.matches ?? false
}

/** Server-rendered output is light; the inline script corrects it before paint. */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
