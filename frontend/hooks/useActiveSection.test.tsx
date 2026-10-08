import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useActiveSection } from '@/hooks/useActiveSection'

const VIEWPORT = 600
const PAGE = 2000

/** Places a section at `top` in document coordinates; jsdom lays nothing out on its own. */
function place(id: string, top: number, height = 300) {
  const el = document.getElementById(id) ?? document.body.appendChild(document.createElement('section'))
  el.id = id
  el.getBoundingClientRect = () =>
    ({ top: top - window.scrollY, bottom: top + height - window.scrollY, height }) as DOMRect
  return el
}

const scrollTo = (y: number) =>
  act(() => {
    window.scrollY = y
    window.dispatchEvent(new Event('scroll'))
  })

function Probe({ ids }: { ids: string[] }) {
  return <span data-testid="active">{useActiveSection(ids) ?? 'none'}</span>
}

const active = () => screen.getByTestId('active').textContent

beforeEach(() => {
  document.body.replaceChildren()
  window.scrollY = 0
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT, configurable: true })
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: PAGE, configurable: true })
  // requestAnimationFrame runs straight away so a scroll is observable in the same act().
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => vi.unstubAllGlobals())

describe('useActiveSection', () => {
  it('starts on the first section before anything has rendered', () => {
    render(<Probe ids={['advice', 'plots', 'season']} />)
    expect(active()).toBe('advice')
  })

  it('picks up sections that appear after it mounts', async () => {
    render(<Probe ids={['advice', 'plots']} />)
    // The farm dashboard renders its sections only once its query resolves.
    await act(async () => {
      place('advice', 400)
      place('plots', 900)
      window.scrollY = 850
      await Promise.resolve()
    })
    scrollTo(850)
    expect(active()).toBe('plots')
  })

  it('follows the reader down the page', () => {
    place('advice', 400)
    place('plots', 900)
    place('season', 1400, 120)
    render(<Probe ids={['advice', 'plots', 'season']} />)

    scrollTo(350) // advice top is now 50, past the line
    expect(active()).toBe('advice')
    scrollTo(850)
    expect(active()).toBe('plots')
  })

  it('shows the first section while the reader is still in the header', () => {
    place('advice', 400)
    place('plots', 900)
    render(<Probe ids={['advice', 'plots']} />)

    scrollTo(850)
    expect(active()).toBe('plots')
    scrollTo(0) // back above every section
    expect(active()).toBe('advice')
  })

  it('shows the last section once the page has nothing left to scroll', () => {
    place('advice', 400)
    place('plots', 900)
    place('season', 1900, 90) // never reaches the line, even at full scroll
    render(<Probe ids={['advice', 'plots', 'season']} />)

    scrollTo(PAGE - VIEWPORT)
    expect(active()).toBe('season')
  })

  it('stops listening when it unmounts', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<Probe ids={['advice']} />)
    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
