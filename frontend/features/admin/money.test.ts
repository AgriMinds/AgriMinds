import { describe, expect, it } from 'vitest'
import { barWidth, formatShare } from './money'

describe('usage share', () => {
  it('never reports real usage as zero', () => {
    // 3 of 250,000 rounds to 0% and reads as "nothing happened", which is false.
    expect(formatShare(3, 250_000)).toBe('<1%')
    expect(formatShare(0, 250_000)).toBe('0%')
    expect(formatShare(125_000, 250_000)).toBe('50%')
    expect(formatShare(250_000, 250_000)).toBe('100%')
  })

  it('says nothing rather than 0% when the tier carries no API at all', () => {
    expect(formatShare(0, 0)).toBe('—')
  })

  it('keeps the bar visible once anything has been spent', () => {
    expect(barWidth(3, 250_000)).toBe('2%')
    expect(barWidth(0, 250_000)).toBe('0%')
    expect(barWidth(500_000, 250_000)).toBe('100%')
  })
})
