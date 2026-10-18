import type { Metadata } from 'next'
import { Exo_2, Plus_Jakarta_Sans } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { RealtimeUpdateNotice } from '@/components/layout/realtime-update-notice'
import { ClockProvider } from '@/hooks/use-clock'
import '../styles/globals.css'

// Same families and weights as the Google Fonts request that index.html used.
const exo2 = Exo_2({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-exo-2',
  display: 'swap',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Squadzr',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  manifest: '/site.webmanifest',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The locale comes from the request (cookie, then Accept-Language), so the first render, the
  // page's language and every date agree before any script runs.
  const locale = await getLocale()

  return (
    <html lang={locale} className={`${exo2.variable} ${plusJakartaSans.variable}`}>
      <body>
        {/* The provider inherits the locale, messages and request time from src/i18n/request.ts. */}
        <NextIntlClientProvider>
          <ClockProvider>
            <div id="root">{children}</div>
            <RealtimeUpdateNotice />
          </ClockProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
