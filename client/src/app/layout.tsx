import type { Metadata } from 'next'
import { Exo_2, Plus_Jakarta_Sans } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { AppFooter } from '@/components/layout/app-footer'
import { AppHeader } from '@/components/layout/app-header'
import { DocumentTitle } from '@/components/layout/document-title'
import { QueryProvider } from '@/components/layout/query-provider'
import { RealtimeUpdateNotice } from '@/components/layout/realtime-update-notice'
import { ClockProvider } from '@/hooks/use-clock'
import { SessionProvider } from '@/hooks/use-session'
import { getRequestSession } from '@/lib/server/session'
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
  // Each route fills in its own title, and the template adds the app name to it.
  title: { default: 'Squadzr', template: '%s · Squadzr' },
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
  // The session is read once per request and seeded into the client, so the first render already
  // knows the viewer.
  const session = await getRequestSession()
  // The footer's year is read on the server, so the server HTML carries it.
  const year = new Date().getFullYear()

  return (
    <html lang={locale} className={`${exo2.variable} ${plusJakartaSans.variable}`}>
      <body>
        <SessionProvider initialSession={session}>
          {/* The provider inherits the locale, messages and request time from src/i18n/request.ts. */}
          <NextIntlClientProvider>
            <ClockProvider>
              <QueryProvider>
                <div id="root" className="flex min-h-screen flex-col bg-background">
                  <AppHeader />

                  <main className="flex-1">{children}</main>

                  <AppFooter year={year} />

                  {/* Eager, so an error toast shows on the first failure instead of waiting for a chunk. */}
                  <Toaster theme="dark" position="top-center" richColors />
                </div>
                <DocumentTitle />
                <RealtimeUpdateNotice />
              </QueryProvider>
            </ClockProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
