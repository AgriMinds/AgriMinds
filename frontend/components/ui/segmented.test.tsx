import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from '@/components/ui/segmented'

const options = [
  { value: 1, label: 'One' },
  { value: 2, label: 'Two' },
  { value: 3, label: 'Three' },
] as const

describe('SegmentedControl', () => {
  it('is a radio group where only the selected option is tabbable', () => {
    render(<SegmentedControl aria-label="Lead" options={options} value={2} onChange={() => {}} />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(radios[1]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveAttribute('tabindex', '0')
    expect(radios[0]).toHaveAttribute('tabindex', '-1')
  })

  it('moves the selection with arrow keys and wraps around', () => {
    const onChange = vi.fn()
    render(<SegmentedControl aria-label="Lead" options={options} value={3} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Three' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(1)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Three' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith(2)
  })
})
