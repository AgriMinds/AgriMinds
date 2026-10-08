import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, JetBrains_Mono, Noto_Sans_Ethiopic, Sora } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Providers } from '@/app/providers'
import { cn } from '@/lib/utils'
import './globals.css'

const sora = Sora({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-sora', display: 'swap' })
const instrument = Instrument_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-instrument', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-jetbrains', display: 'swap' })
const ethiopic = Noto_Sans_Ethiopic({
  subsets: ['ethiopic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-noto-ethiopic',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#173f36' },
    { media: '(prefers-color-scheme: dark)', color: '#101915' },
  ],
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app')
  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('tagline'),
    applicationName: t('title'),
    keywords: ['Ethiopia', 'agriculture', 'drought early warning', 'farmer advisory', 'AI-DREWS', 'Choke Mountain'],
    icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const t = await getTranslations('app')
  return (
    <html
      lang={locale}
      className={cn(sora.variable, instrument.variable, jetbrains.variable, ethiopic.variable)}
      suppressHydrationWarning
    >
      <head>
        <script
          // Apply the stored theme before paint to avoid a flash; mirrors ThemeToggle's storage key.
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('agriminds-theme');if(t==='dark'||t==='light'){document.documentElement.classList.add(t)}}catch(e){}`,
          }}
        />
      </head>
      <body className={cn('min-h-svh', locale === 'am' && 'font-ethiopic')}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:shadow-lg"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
