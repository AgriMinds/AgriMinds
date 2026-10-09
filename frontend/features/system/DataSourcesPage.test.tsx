import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataInventory } from '@agriminds/api-types'
import { FORMATS } from '@/i18n/config'
import messages from '@/messages/en.json'

const dataSources = vi.fn()
vi.mock('@/lib/api/client', () => ({ api: { dataSources: () => dataSources() } }))

const { DataSourcesPage } = await import('@/features/system/DataSourcesPage')

const source = (key: string, status: DataInventory['sources'][number]['status']) => ({
  key,
  name: `${key} source`,
  provider: `${key} provider`,
  feeds: `${key} feeds`,
  detail: `${key} detail`,
  status,
  records: 317,
  coverage_start: '2000-01-01',
  coverage_end: '2026-05-01',
  retrieved_at: '2026-10-08T20:15:00+00:00',
  citation: `${key} citation`,
})

const inventory: DataInventory = {
  connected: 1,
  total: 3,
  data_source: 'synthetic',
  model_version: 'superhybrid-0.1.0',
  issued_date: '2026-06-01',
  caveat: 'The forecast is built on synthetic data and must not drive field decisions.',
  sources: [source('pdsi', 'connected'), source('era5', 'synthetic'), source('csa', 'not_connected')],
}

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Addis_Ababa" formats={FORMATS}>
        <DataSourcesPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )

describe('DataSourcesPage', () => {
  beforeEach(() => dataSources.mockReset())

  it('reports how many inputs are real rather than how many are listed', async () => {
    dataSources.mockResolvedValue(inventory)
    wrap()
    expect(await screen.findByText('1 of 3 inputs are supplying real data')).toBeInTheDocument()
  })

  it('shows the caveat whenever the forecast is not from real data', async () => {
    dataSources.mockResolvedValue(inventory)
    wrap()
    expect(await screen.findByText(/must not drive field decisions/)).toBeInTheDocument()
  })

  it('gives every status a worded badge, so colour is never the only cue', async () => {
    dataSources.mockResolvedValue(inventory)
    wrap()
    const rows = await screen.findAllByRole('listitem')
    const labels = ['Connected', 'Stand-in data', 'Not connected']
    expect(rows).toHaveLength(labels.length)
    labels.forEach((label, i) => expect(within(rows[i]!).getByText(label)).toBeInTheDocument())
  })

  it('names each input, its provider and what it feeds', async () => {
    dataSources.mockResolvedValue(inventory)
    wrap()
    expect(await screen.findByText('era5 source')).toBeInTheDocument()
    expect(screen.getByText('era5 provider')).toBeInTheDocument()
    expect(screen.getByText('era5 feeds')).toBeInTheDocument()
  })

  it('shows what each source covers and when it was last downloaded', async () => {
    dataSources.mockResolvedValue(inventory)
    wrap()
    expect((await screen.findAllByText('2000-01-01 → 2026-05-01')).length).toBe(3)
    expect(screen.getAllByText('October 8, 2026').length).toBe(3)
  })

  it('offers the upstream citation without putting it in the way', async () => {
    dataSources.mockResolvedValue(inventory)
    wrap()
    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]!).getByText('How to cite this dataset')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('pdsi citation')).toBeInTheDocument()
  })

  it('leaves out provenance a source has not reported', async () => {
    dataSources.mockResolvedValue({
      ...inventory,
      sources: [{ ...source('bare', 'not_connected'), coverage_start: null, coverage_end: null, retrieved_at: null, citation: null }],
    })
    wrap()
    expect(await screen.findByText('bare source')).toBeInTheDocument()
    expect(screen.queryByText('Covers')).not.toBeInTheDocument()
    expect(screen.queryByText('How to cite this dataset')).not.toBeInTheDocument()
  })

  it('says so plainly when a deployment reports no inventory', async () => {
    dataSources.mockResolvedValue({ ...inventory, connected: 0, total: 0, caveat: null, sources: [] })
    wrap()
    expect(await screen.findByText('No inventory is available from this deployment.')).toBeInTheDocument()
  })
})
