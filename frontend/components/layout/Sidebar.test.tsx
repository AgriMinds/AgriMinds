import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '@agriminds/api-types'
import messages from '@/messages/en.json'

const pathname = vi.fn(() => '/farm')
vi.mock('next/navigation', () => ({ usePathname: () => pathname() }))
vi.mock('@/app/actions/locale', () => ({ setLocale: vi.fn() }))

const farmerDashboard = vi.fn()
const health = vi.fn(() => ({ data: undefined, status: 'unknown' }))
vi.mock('@/features/farmer/useFarmer', () => ({
  farmerKeys: { dashboard: (lead: number) => ['farmer', 'dashboard', lead] },
  useFarmerDashboard: () => farmerDashboard(),
}))
vi.mock('@/features/health/useHealth', () => ({ useHealth: () => health() }))

const { FARM_SECTIONS, Sidebar, navForRole } = await import('@/components/layout/Sidebar')

const wrap = (role: Role, name = 'Alemu Tadesse', props: { open?: boolean; onClose?: () => void } = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <Sidebar open={props.open ?? true} onClose={props.onClose ?? (() => {})} user={{ name, role }} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )

describe('navForRole', () => {
  it('offers a farmer only their own dashboard', () => {
    expect(navForRole('farmer').map((i) => i.href)).toEqual(['/farm'])
  })

  it('offers staff analytics and provenance alongside the operational views', () => {
    const operational = [
      '/ministry',
      '/watershed',
      '/prediction',
      '/crop-yield',
      '/analytics',
      '/data-sources',
      // Any staff member can see what their own organisation is on and owes.
      '/billing',
    ]
    for (const role of ['agent', 'minister'] as const) {
      expect(navForRole(role).map((i) => i.href)).toEqual(operational)
    }
    // An administrator gets the same views plus the commercial one.
    expect(navForRole('admin').map((i) => i.href)).toEqual([
      ...operational,
      '/admin/requests',
      '/admin/organizations',
      '/admin/pricing',
    ])
  })

  it('offers the commercial pages to an administrator only', () => {
    // Both routes redirect everyone else, so offering them would be offering a dead end.
    for (const href of ['/admin/pricing', '/admin/organizations', '/admin/requests']) {
      for (const role of ['farmer', 'agent', 'minister'] as const) {
        expect(navForRole(role).some((i) => i.href === href)).toBe(false)
      }
      expect(navForRole('admin').some((i) => i.href === href)).toBe(true)
    }
  })

  it('never offers a farmer a link they would be redirected away from', () => {
    for (const href of [
      '/analytics',
      '/ministry',
      '/watershed',
      '/prediction',
      '/crop-yield',
      '/data-sources',
    ]) {
      expect(navForRole('farmer').some((i) => i.href === href)).toBe(false)
    }
  })
})

describe('Sidebar', () => {
  beforeEach(() => {
    pathname.mockReturnValue('/farm')
    farmerDashboard.mockReturnValue({ data: undefined })
  })

  it('names who is signed in', () => {
    wrap('minister')
    expect(screen.getByText('Alemu Tadesse')).toBeInTheDocument()
    expect(screen.getByText('Ministry')).toBeInTheDocument()
  })

  it('tells a farmer how much land they have and where, once the dashboard has loaded', () => {
    farmerDashboard.mockReturnValue({
      data: {
        farms: [{ id: 'a' }, { id: 'b' }],
        user: { woreda: { name_en: 'Hulet Ej Enese', name_am: 'ሁለት እጅ እነሴ', name_om: 'Hulet Ej Enese' } },
      },
    })
    wrap('farmer')
    expect(screen.getByText('2 plots · Hulet Ej Enese')).toBeInTheDocument()
  })

  it('falls back to the role label before the dashboard answers', () => {
    wrap('farmer')
    expect(screen.getByText('Farmer')).toBeInTheDocument()
  })

  it('gives a farmer the sections of their page, not a column with one link', () => {
    wrap('farmer')
    expect(screen.getByText('On this page')).toBeInTheDocument()
    for (const { id } of FARM_SECTIONS) {
      expect(
        screen.getByRole('link', { name: messages.nav[id as keyof typeof messages.nav] }),
      ).toHaveAttribute('href', `#${id}`)
    }
  })

  it('does not offer in-page sections from a page that has none', () => {
    pathname.mockReturnValue('/settings')
    wrap('farmer')
    expect(screen.queryByText('On this page')).not.toBeInTheDocument()
  })

  it('spells each language out in its own script for a farmer', () => {
    wrap('farmer')
    const group = screen.getByRole('radiogroup', { name: 'Language' })
    expect(within(group).getByRole('radio', { name: /English/ })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('radio', { name: 'አማርኛ' })).toBeInTheDocument()
    expect(within(group).getByRole('radio', { name: 'Afaan Oromoo' })).toBeInTheDocument()
  })

  it('shows staff the model card instead of the language list', () => {
    wrap('minister')
    expect(screen.getByText('Forecast model')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('marks the current route for a screen reader', () => {
    pathname.mockReturnValue('/data-sources')
    wrap('minister')
    expect(screen.getByRole('link', { name: 'Data sources' })).toHaveAttribute('aria-current', 'page')
  })

  describe('the drawer below lg', () => {
    // jsdom has no matchMedia, so `useMediaQuery` reports false — the small-screen layout, which
    // is the case these assertions are about.
    it('is taken out of the tab order when closed', () => {
      // `-translate-x-full` moves it off-screen but leaves it focusable, so without `inert` a
      // keyboard user tabs from the top bar straight into an invisible menu.
      const { container } = wrap('minister', 'Alemu Tadesse', { open: false })
      expect(container.querySelector('aside')).toHaveAttribute('inert')
    })

    it('is reachable again once opened', () => {
      const { container } = wrap('minister', 'Alemu Tadesse', { open: true })
      expect(container.querySelector('aside')).not.toHaveAttribute('inert')
    })

    it('closes on Escape, like the user menu', () => {
      const onClose = vi.fn()
      wrap('minister', 'Alemu Tadesse', { open: true, onClose })
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalled()
    })

    it('stops the page behind it scrolling while it is open', () => {
      const { unmount } = wrap('minister', 'Alemu Tadesse', { open: true })
      expect(document.body.style.overflow).toBe('hidden')
      unmount()
      expect(document.body.style.overflow).not.toBe('hidden')
    })
  })
})
