import { describe, expect, it } from 'vitest'
import { ENSO_CATEGORIES, PDSI_CATEGORIES } from '@agriminds/api-types'
import messages from '@/messages/en.json'
import {
  ENSO_BADGE_VARIANT,
  ENSO_ICON,
  ENSO_ORDER,
  ENSO_TEXT_CLASS,
  PDSI_CELL_CLASS,
  PDSI_DOT_CLASS,
  PDSI_ICON,
  PDSI_ORDER,
  ensoKey,
  formatPdsi,
  isEnsoExtreme,
  isPdsiDrought,
  pdsiKey,
} from '@/lib/classification'

describe('Sc-PDSI bands', () => {
  it('styles all seven bands', () => {
    expect(PDSI_CATEGORIES).toHaveLength(7)
    expect(new Set(Object.values(PDSI_ICON)).size).toBe(7)
    for (const band of PDSI_CATEGORIES) {
      expect(PDSI_CELL_CLASS[band]).toMatch(/^bg-pdsi-[a-z-]+ text-pdsi-(ink|paper)$/)
      expect(PDSI_DOT_CLASS[band]).toMatch(/^bg-pdsi-[a-z-]+$/)
      expect(PDSI_ICON[band]).toBeDefined()
    }
  })

  it('gives every band its own fill, so two bands never share a colour', () => {
    const fills = PDSI_CATEGORIES.map((b) => PDSI_DOT_CLASS[b])
    expect(new Set(fills).size).toBe(PDSI_CATEGORIES.length)
  })

  it('never reuses a forecast-risk token, so the two scales cannot collide', () => {
    for (const band of PDSI_CATEGORIES) {
      expect(PDSI_CELL_CLASS[band]).not.toMatch(/risk-/)
    }
  })

  it('orders driest to wettest', () => {
    expect(PDSI_ORDER['Extremely dry']).toBe(0)
    expect(PDSI_ORDER.Normal).toBe(3)
    expect(PDSI_ORDER['Extremely wet']).toBe(6)
  })

  it('has a translation for every band', () => {
    for (const band of PDSI_CATEGORIES) {
      expect(messages.pdsi[pdsiKey(band) as keyof typeof messages.pdsi]).toBe(band)
    }
  })

  it('flags exactly the three dry bands as drought', () => {
    expect(PDSI_CATEGORIES.filter(isPdsiDrought)).toEqual([
      'Extremely dry',
      'Very dry',
      'Moderately dry',
    ])
  })

  it('formats the index as a signed value, never as a percentage', () => {
    expect(formatPdsi(1.84)).toBe('+1.8')
    expect(formatPdsi(-2.31)).toBe('−2.3')
    expect(formatPdsi(0)).toBe('0.0')
    expect(formatPdsi(1.84)).not.toContain('%')
  })
})

describe('ENSO bands', () => {
  it('styles all five bands', () => {
    expect(ENSO_CATEGORIES).toHaveLength(5)
    expect(new Set(Object.values(ENSO_ICON)).size).toBe(5)
    for (const band of ENSO_CATEGORIES) {
      expect(ENSO_TEXT_CLASS[band]).toMatch(/^text-/)
      expect(ENSO_BADGE_VARIANT[band]).toBeTruthy()
      expect(ENSO_ICON[band]).toBeDefined()
    }
  })

  it('orders La Niña through El Niño, matching the gauge', () => {
    expect(ENSO_ORDER['High La Niña']).toBe(0)
    expect(ENSO_ORDER.Neutral).toBe(2)
    expect(ENSO_ORDER['High El Niño']).toBe(4)
  })

  it('has a translation for every band, accents and all', () => {
    for (const band of ENSO_CATEGORIES) {
      expect(messages.ensoBand[ensoKey(band) as keyof typeof messages.ensoBand]).toBe(band)
    }
    expect(ensoKey('High El Niño')).toBe('highElNino')
    expect(ensoKey('Moderate La Niña')).toBe('moderateLaNina')
  })

  it('treats only the High bands as extreme', () => {
    expect(ENSO_CATEGORIES.filter(isEnsoExtreme)).toEqual(['High La Niña', 'High El Niño'])
  })
})
