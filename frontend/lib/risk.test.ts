import { describe, expect, it } from 'vitest'
import { cellClassFor, ensoPhase, riskLevelFor } from '@/lib/risk'

describe('riskLevelFor', () => {
  it('matches the backend thresholds', () => {
    expect(riskLevelFor(0)).toBe('Low')
    expect(riskLevelFor(0.249)).toBe('Low')
    expect(riskLevelFor(0.25)).toBe('Moderate')
    expect(riskLevelFor(0.45)).toBe('High')
    expect(riskLevelFor(0.65)).toBe('Severe')
    expect(riskLevelFor(1)).toBe('Severe')
  })
  it('maps to token classes only', () => {
    expect(cellClassFor(0.7)).toContain('bg-risk-severe')
    expect(cellClassFor(0.1)).not.toMatch(/#[0-9a-f]{3,6}/i)
  })
})

describe('ensoPhase', () => {
  it('uses the ±0.5 °C thresholds', () => {
    expect(ensoPhase(0.5)).toBe('warm')
    expect(ensoPhase(-0.5)).toBe('cool')
    expect(ensoPhase(0.49)).toBe('neutral')
  })
})
