import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyticsConnection, EmbedConfig, PowerBiStatus } from '@agriminds/api-types'
import messages from '@/messages/en.json'

const powerbiStatus = vi.fn<() => Promise<PowerBiStatus>>()
const powerbiEmbedToken = vi.fn<() => Promise<EmbedConfig>>()
const analyticsConnection = vi.fn<() => Promise<AnalyticsConnection>>()

vi.mock('@/lib/api/client', () => ({
  api: {
    get powerbiStatus() {
      return powerbiStatus
    },
    get powerbiEmbedToken() {
      return powerbiEmbedToken
    },
    get analyticsConnection() {
      return analyticsConnection
    },
  },
  ApiError: class ApiError extends Error {
    status = 500
    code = 'x'
  },
  PBIDS_PATH: '/api/v1/analytics/connection.pbids',
}))

vi.mock('powerbi-client', () => ({
  models: {
    TokenType: { Embed: 1 },
    BackgroundType: { Transparent: 1 },
    LayoutType: { Custom: 2 },
    DisplayOption: { FitToWidth: 1 },
  },
}))

vi.mock('powerbi-client-react', () => ({
  PowerBIEmbed: ({ getEmbeddedComponent }: { getEmbeddedComponent?: (o: unknown) => void }) => {
    useEffect(() => {
      getEmbeddedComponent?.({ setAccessToken: vi.fn().mockResolvedValue(undefined) })
    }, [getEmbeddedComponent])
    return <div data-testid="embed" />
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
  note: 'Connect with Get Data > PostgreSQL.',
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
  powerbiStatus.mockReset()
  powerbiEmbedToken.mockReset()
  analyticsConnection.mockReset()
  analyticsConnection.mockResolvedValue(connection)
})

describe('AnalyticsPage when Power BI is configured', () => {
  beforeEach(() => {
    powerbiStatus.mockResolvedValue({
      configured: true,
      reason: null,
      workspace_id: 'ws',
      report_id: 'report-1',
      rls_role: null,
    })
    powerbiEmbedToken.mockResolvedValue({
      report_id: 'report-1',
      embed_url: 'https://app.powerbi.com/reportEmbed',
      access_token: 'token',
      expires_at: new Date(Date.now() + 50 * 60_000).toISOString(),
      scope: 'Whole watershed',
      rls_applied: false,
    })
  })

  it('embeds the report', async () => {
    wrap(<AnalyticsPage role="minister" />)
    expect(await screen.findByTestId('embed')).toBeInTheDocument()
    expect(powerbiEmbedToken).toHaveBeenCalled()
    expect(screen.queryByText(/Power BI reports will appear here/)).not.toBeInTheDocument()
  })
})

describe('AnalyticsPage when Power BI is not configured', () => {
  const reason = 'not set: AGRIMINDS_POWERBI_TENANT_ID, AGRIMINDS_POWERBI_CLIENT_ID'

  beforeEach(() => {
    powerbiStatus.mockResolvedValue({
      configured: false,
      reason,
      workspace_id: null,
      report_id: null,
      rls_role: null,
    })
  })

  it('explains the situation instead of showing a broken frame', async () => {
    wrap(<AnalyticsPage role="minister" />)
    expect(await screen.findByText(/Power BI reports will appear here/)).toBeInTheDocument()
    expect(screen.queryByTestId('embed')).not.toBeInTheDocument()
  })

  it('tells a reader what the tab will show once it is connected', async () => {
    wrap(<AnalyticsPage role="minister" />)
    expect(await screen.findByText(/What you will see once it is connected/)).toBeInTheDocument()
    expect(screen.getByText(/Registered farmers, plots and hectares/)).toBeInTheDocument()
    expect(screen.getByText(/Advisories delivered to farmers/)).toBeInTheDocument()
    expect(screen.getByText(/Forecast history month by month/)).toBeInTheDocument()
    expect(screen.getByText(/crop mix across registered land/)).toBeInTheDocument()
  })

  it('keeps the setup requirements out of a minister\'s way', async () => {
    wrap(<AnalyticsPage role="minister" />)
    await screen.findByText(/Power BI reports will appear here/)
    // "Entra service principal" and "paid capacity" are an administrator's problem.
    expect(screen.queryByText(/Entra/)).not.toBeInTheDocument()
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument()
  })

  it('never asks for a token it already knows will be refused', async () => {
    wrap(<AnalyticsPage role="minister" />)
    await screen.findByText(/Power BI reports will appear here/)
    expect(powerbiEmbedToken).not.toHaveBeenCalled()
  })

  it('reassures the reader that the native dashboards still cover the work', async () => {
    wrap(<AnalyticsPage role="minister" />)
    expect(await screen.findByText(/national overview and the watershed forecast/i)).toBeInTheDocument()
  })

  it('keeps the unset variables away from a minister', async () => {
    wrap(<AnalyticsPage role="minister" />)
    await screen.findByText(/Power BI reports will appear here/)
    expect(screen.queryByTestId('powerbi-reason')).not.toBeInTheDocument()
    expect(screen.queryByText(/AGRIMINDS_POWERBI_TENANT_ID/)).not.toBeInTheDocument()
    expect(screen.queryByText('What an administrator needs to do')).not.toBeInTheDocument()
  })

  it('shows an administrator exactly which variables are missing', async () => {
    wrap(<AnalyticsPage role="admin" />)
    expect(await screen.findByTestId('powerbi-reason')).toHaveTextContent(reason)
    expect(screen.getByText('What an administrator needs to do')).toBeInTheDocument()
  })

  it('offers an administrator a way to connect Power BI Desktop today', async () => {
    wrap(<AnalyticsPage role="admin" />)
    expect(await screen.findByTestId('analytics-connection')).toBeInTheDocument()
    expect(await screen.findByText('db.example:5432')).toBeInTheDocument()
    expect(screen.getByText('agriminds_bi')).toBeInTheDocument()
    expect(screen.getByText('fact_farm')).toBeInTheDocument()
    const download = screen.getByRole('link', { name: /download connection file/i })
    expect(download).toHaveAttribute('href', '/api/v1/analytics/connection.pbids')
    expect(download).toHaveAttribute('download')
  })

  it('does not request connection details for staff who may not have them', async () => {
    wrap(<AnalyticsPage role="minister" />)
    await screen.findByText(/Power BI reports will appear here/)
    expect(analyticsConnection).not.toHaveBeenCalled()
    expect(screen.queryByTestId('analytics-connection')).not.toBeInTheDocument()
  })

  it('requests them for an administrator', async () => {
    wrap(<AnalyticsPage role="admin" />)
    await screen.findByTestId('analytics-connection')
    expect(analyticsConnection).toHaveBeenCalled()
  })
})

describe('the unconfigured page as a route forward', () => {
  beforeEach(() => {
    powerbiStatus.mockResolvedValue({
      configured: false,
      reason: 'not set: AGRIMINDS_POWERBI_TENANT_ID',
      workspace_id: null,
      report_id: null,
      rls_role: null,
    })
  })

  it('points the reader at the dashboards that do cover the work', async () => {
    wrap(<AnalyticsPage role="minister" />)
    expect(await screen.findByRole('link', { name: /national overview/i })).toHaveAttribute('href', '/ministry')
    expect(screen.getByRole('link', { name: /watershed forecast/i })).toHaveAttribute('href', '/watershed')
  })
})
