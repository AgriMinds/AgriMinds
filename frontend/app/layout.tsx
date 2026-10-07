import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#173f36' }
export const metadata: Metadata = { title: 'AgriMinds AI-DREWS | Ministry Command Center', description: 'Drought early warning and climate decision support for Ethiopia\'s farmers and agricultural leaders.', keywords: ['Ethiopia', 'agriculture', 'drought early warning', 'farmer advisory', 'AI-DREWS'] }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
