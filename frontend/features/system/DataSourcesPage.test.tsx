import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataInventory } from '@agriminds/api-types'
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
      <NextIntlClientProvider locale="en" messages={messages}>
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

  it('says so plainly when a deployment reports no inventory', async () => {
    dataSources.mockResolvedValue({ ...inventory, connected: 0, total: 0, caveat: null, sources: [] })
    wrap()
    expect(await screen.findByText('No inventory is available from this deployment.')).toBeInTheDocument()
  })
})
