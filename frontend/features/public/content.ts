/**
 * The figures on the public pages, read from the trained artefacts rather than written as copy.
 *
 * They are kept here, beside the pages that print them, and deliberately not translated: a metric
 * is the same number in every language, and a translated metric is a metric somebody can mistype.
 * The prose that frames them lives in the message catalogues.
 */

export const STEPS = ['observe', 'model', 'advise', 'deliver'] as const

export const SEGMENTS = [
  'farmer',
  'cooperative',
  'agent',
  'ministry',
  'research',
  'insurer',
] as const

export const REACH = [
  { key: 'app', badge: 'APP' },
  { key: 'hotline', badge: '977' },
  { key: 'agent', badge: 'DA' },
] as const

type Metric = { label: string; value: string }

export const MODELS: { key: string; arch: string; metrics: Metric[] }[] = [
  {
    key: 'drought',
    // data/models/drought_meta.json — superhybrid-0.2.0, skilful_leads [1]
    arch: 'CNN-2D + LSTM + Fourier · superhybrid-0.2.0',
    metrics: [
      { label: 'Skilful lead', value: '1 month' },
      { label: 'Grid', value: '8 × 8 cells' },
      { label: 'Trained to', value: 'Jun 2026' },
    ],
  },
  {
    key: 'enso',
    // data/models/enso_meta.json — NOAA record 1951-2026, 745/60/79 split, 12 leads
    arch: 'CNN-LSTM vs persistence · NOAA Niño 3.4',
    metrics: [
      { label: 'Record', value: '1951–2026' },
      { label: 'Months', value: '884' },
      { label: 'Leads', value: '1–12' },
    ],
  },
  {
    key: 'yield',
    // data/models/crop_yield_meta.json — test_r2 0.78, test_rmse 7.132, test_mape 23.73
    arch: 'XGBoost · crop-yield-0.2.0',
    metrics: [
      { label: 'Test R²', value: '0.78' },
      { label: 'RMSE', value: '7.13 qt/ha' },
      { label: 'MAPE', value: '23.7%' },
    ],
  },
]

/** Who built it. Institutions and roles only — see the note in `about/page.tsx`. */
export const TEAM = [
  {
    name: 'Dr. Megbar Wondie',
    role: 'teamLead',
    detail: 'Associate Professor of Atmospheric Physics',
    institution: 'Debre Markos University, Ethiopia',
  },
  {
    name: 'Ambachow Kahsay',
    role: 'dataScience',
    institution: 'United States International University Africa, Kenya',
  },
  {
    name: 'Bona Nasser',
    role: 'statistics',
    institution: 'Haramaya University, Ethiopia',
  },
  {
    name: 'Bethelhem Legesse',
    role: 'frontend',
    institution: 'Raya University, Ethiopia',
  },
  {
    name: 'Eibrahim Belayneh',
    role: 'engineering',
    institution: 'Fusion IT Consultancy PLC',
  },
] as const

export const DATA_SOURCES = [
  { key: 'chirps', provider: 'CHIRPS (UCSB)', feeds: 'rainfall' },
  { key: 'era5', provider: 'ERA5 (ECMWF)', feeds: 'balance' },
  { key: 'nino34', provider: 'NOAA ONI', feeds: 'enso' },
  { key: 'csa', provider: 'CSA Ethiopia', feeds: 'crops' },
] as const
