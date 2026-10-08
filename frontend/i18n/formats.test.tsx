import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { NextIntlClientProvider, useFormatter } from 'next-intl'
import { describe, expect, it } from 'vitest'
import { FORMATS } from '@/i18n/config'

function sources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) sources(path, acc)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) acc.push(path)
  }
  return acc
}

function Probe({ name }: { name: string }) {
  const format = useFormatter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <span>{format.dateTime(new Date('2026-06-18T09:30:00Z'), name as any)}</span>
}

describe('named date formats', () => {
  /**
   * next-intl throws MISSING_FORMAT for a name it was never given, and the timestamp silently
   * loses its formatting. This catches a new `format.dateTime(d, 'name')` whose name was never
   * declared, which is how the ministry dashboard's "generated at" line broke.
   */
  it('declares every named dateTime format the app asks for', () => {
    const used = new Set<string>()
    for (const file of ['app', 'components', 'features', 'lib'].flatMap((d) => sources(d))) {
      // The first argument may itself contain parentheses, e.g. dateTime(new Date(x), 'short').
      for (const match of readFileSync(file, 'utf8').matchAll(/\.dateTime\(.+?,\s*'([^']+)'\s*\)/g)) {
        used.add(match[1]!)
      }
    }
    expect(used.size).toBeGreaterThan(0)
    expect([...used].filter((name) => !(name in FORMATS.dateTime))).toEqual([])
  })

  it.each(Object.keys(FORMATS.dateTime))('renders a readable timestamp for %s', (name) => {
    const { container } = render(
      <NextIntlClientProvider locale="en" timeZone="Africa/Addis_Ababa" formats={FORMATS}>
        <Probe name={name} />
      </NextIntlClientProvider>,
    )
    // A missing format falls back to the raw ISO string; a declared one is localised instead.
    const text = container.textContent ?? ''
    expect(text).not.toBe('2026-06-18T09:30:00.000Z')
    expect(text).toMatch(/\d/)
    expect(text).not.toContain('T09:30')
  })
})
