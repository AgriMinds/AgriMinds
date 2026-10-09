import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyticsConnection, EmbedConfig, MetabaseStatus } from '@agriminds/api-types'
import messages from '@/messages/en.json'

const metabaseStatus = vi.fn<() => Promise<MetabaseStatus>>()
const metabaseEmbed = vi.fn<() => Promise<EmbedConfig>>()
const analyticsConnection = vi.fn<() => Promise<AnalyticsConnection>>()

vi.mock('@/lib/api/client', () => ({
  api: {
    get metabaseStatus() {
      return metabaseStatus
    },
    get metabaseEmbed() {
      return metabaseEmbed
    },
    get analyticsConnection() {
      return analyticsConnection
    },
  },
  ApiError: class ApiError extends Error {
    status = 500
    code = 'x'
  },
}))

const { AnalyticsPage } = await import('@/features/analytics/AnalyticsPage')

const connection: AnalyticsConnection = {
  protocol: 'postgresql',
  server: 'db.example:5432',
  database: 'agriminds',
  schema: 'analytics',
  read_only_role: 'agriminds_bi',
  views: ['dim_woreda', 'fact_farm', 'fact_risk'],
  note: 'Point any SQL client at this database.',
}

const wrap = (ui: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  metabaseStatus.mockReset()
  metabaseEmbed.mockReset()
  analyticsConnection.mockReset()
  analyticsConnection.mockResolvedValue(connection)
})

describe('AnalyticsPage when the dashboard is configured', () => {
  const embedUrl = 'http://localhost:3001/embed/dashboard/signed.jwt.token#bordered=false'

  beforeEach(() => {
    metabaseStatus.mockResolvedValue({
      configured: true,
      reason: null,
      site_url: 'http://localhost:3001',
      dashboard_id: 7,
      woreda_param: null,
    })
    metabaseEmbed.mockResolvedValue({
      dashboard_id: 7,
      embed_url: embedUrl,
      expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      scope: 'the whole watershed',
      scoped: false,
    })
  })

  it('embeds the dashboard at the signed URL', async () => {
    wrap(<AnalyticsPage role="minister" />)
    const frame = await screen.findByTitle('Ministry analytics dashboard')
    expect(frame).toHaveAttribute('src', embedUrl)
    expect(metabaseEmbed).toHaveBeenCalled()
    expect(screen.queryByText(/Your dashboard will appear here/)).not.toBeInTheDocument()
  })

  it('says which rows the viewer is seeing', async () => {
    wrap(<AnalyticsPage role="minister" />)
    expect(await screen.findByText(/the whole watershed/)).toBeInTheDocument()
    expect(screen.queryByText('Restricted by the server')).not.toBeInTheDocument()
  })

  it('marks a viewer whose rows the server narrowed', async () => {
    metabaseEmbed.mockResolvedValue({
      dashboard_id: 7,
      embed_url: embedUrl,
      expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      scope: 'Sinan woreda only',
      scoped: true,
    })
    wrap(<AnalyticsPage role="agent" />)
    expect(await screen.findByText('Restricted by the server')).toBeInTheDocument()
    expect(screen.getByText(/Sinan woreda only/)).toBeInTheDocument()
  })

  it('sandboxes the frame rather than trusting the embed', async () => {
    wrap(<AnalyticsPage role="minister" />)
    const frame = await screen.findByTitle('Ministry analytics dashboard')
    const sandbox = frame.getAttribute('sandbox') ?? ''
    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).not.toContain('allow-top-navigation')
    expect(frame).toHaveAttribute('referrerPolicy', 'no-referrer')
  })
})

describe('AnalyticsPage when the dashboard is not configured', () => {
  const reason = 'Not configured: AGRIMINDS_METABASE_SECRET_KEY, AGRIMINDS_METABASE_DASHBOARD_ID are unset.'

  beforeEach(() => {
    metabaseStatus.mockResolvedValue({
      configured: false,
      reason,
      site_url: null,
      dashboard_id: null,
      woreda_param: null,
    })
  })

  it('explains the situation instead of showing a broken frame', async () => {
    wrap(<AnalyticsPage role="minister" />)
    expect(await screen.findByText(/Your dashboard will appear here/)).toBeInTheDocument()
    expect(screen.queryByTitle('Ministry analytics dashboard')).not.toBeInTheDocument()
  })

  it('tells a reader what the tab will show once it is connected', async () => {
    wrap(<AnalyticsPage role="minister" />)
    expect(await screen.findByText(/What you will see once it is connected/)).toBeInTheDocument()
    expect(screen.getByText(/Registered farmers, plots and hectares/)).toBeInTheDocument()
    expect(screen.getByText(/Advisories delivered to farmers/)).toBeInTheDocument()
    expect(screen.getByText(/Forecast history month by month/)).toBeInTheDocument()
    expect(screen.getByText(/crop mix across registered land/)).toBeInTheDocument()
  })

  it("keeps the setup instructions out of a minister's way", async () => {
    wrap(<AnalyticsPage role="minister" />)
    await screen.findByText(/Your dashboard will appear here/)
    expect(screen.queryByText(/docker compose/)).not.toBeInTheDocument()
    expect(screen.queryByText(/bi-role/)).not.toBeInTheDocument()
  })

  it('never asks for a URL it already knows will be refused', async () => {
    wrap(<AnalyticsPage role="minister" />)
    await screen.findByText(/Your dashboard will appear here/)
    expect(metabaseEmbed).not.toHaveBeenCalled()
  })

  it('reassures the reader that the native dashboards still cover the work', async () => {
    wrap(<AnalyticsPage role="minister" />)
    expect(await screen.findByText(/national overview and the watershed forecast/i)).toBeInTheDocument()
  })

  it('keeps the unset variables away from a minister', async () => {
    wrap(<AnalyticsPage role="minister" />)
    await screen.findByText(/Your dashboard will appear here/)
    expect(screen.queryByTestId('metabase-reason')).not.toBeInTheDocument()
    expect(screen.queryByText(/AGRIMINDS_METABASE_SECRET_KEY/)).not.toBeInTheDocument()
    expect(screen.queryByText('What an administrator needs to do')).not.toBeInTheDocument()
  })

  it('shows an administrator exactly which variables are missing', async () => {
    wrap(<AnalyticsPage role="admin" />)
    expect(await screen.findByTestId('metabase-reason')).toHaveTextContent(reason)
    expect(screen.getByText('What an administrator needs to do')).toBeInTheDocument()
  })

  it('offers an administrator a schema they can query today', async () => {
    wrap(<AnalyticsPage role="admin" />)
    expect(await screen.findByTestId('analytics-connection')).toBeInTheDocument()
    expect(await screen.findByText('db.example:5432')).toBeInTheDocument()
    expect(screen.getByText('agriminds_bi')).toBeInTheDocument()
    expect(screen.getByText('fact_farm')).toBeInTheDocument()
  })

  it('does not request connection details for staff who may not have them', async () => {
    wrap(<AnalyticsPage role="minister" />)
    await screen.findByText(/Your dashboard will appear here/)
    expect(analyticsConnection).not.toHaveBeenCalled()
    expect(screen.queryByTestId('analytics-connection')).not.toBeInTheDocument()
  })

  it('requests them for an administrator', async () => {
    wrap(<AnalyticsPage role="admin" />)
    await screen.findByTestId('analytics-connection')
    expect(analyticsConnection).toHaveBeenCalled()
  })

  it('points the reader at the dashboards that do cover the work', async () => {
    wrap(<AnalyticsPage role="minister" />)
    expect(await screen.findByRole('link', { name: /national overview/i })).toHaveAttribute('href', '/ministry')
    expect(screen.getByRole('link', { name: /watershed forecast/i })).toHaveAttribute('href', '/watershed')
  })
})
