import type { Metadata } from 'next'
import { Big_Shoulders, Exo_2, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { DocumentTitle } from '@/components/layout/document-title'
import { QueryProvider } from '@/components/layout/query-provider'
import { RealtimeUpdateNotice } from '@/components/layout/realtime-update-notice'
import { ClockProvider } from '@/hooks/use-clock'
import { SessionProvider } from '@/hooks/use-session'
import { getRequestSession } from '@/lib/server/session'
import '../styles/globals.css'

// The heading family of today's screens. CCC-118 removes it once no screen uses it.
const exo2 = Exo_2({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-exo-2',
  display: 'swap',
})

// The Redesign v2 families (docs/design/reference.md, Typography): display, body and mono.
const bigShoulders = Big_Shoulders({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-big-shoulders',
  display: 'swap',
  // Next has no size-adjust metrics for this family, so it gets a manual fallback instead of one
  // generated from them (without it, every build warns).
  fallback: ['Impact', 'sans-serif'],
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const fontVariables = [exo2, bigShoulders, plusJakartaSans, jetBrainsMono]
  .map((font) => font.variable)
  .join(' ')

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

  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <SessionProvider initialSession={session}>
          {/* The provider inherits the locale, messages and request time from src/i18n/request.ts. */}
          <NextIntlClientProvider>
            <ClockProvider>
              <QueryProvider>
                {children}
                {/* Eager, so an error toast shows on the first failure instead of waiting for a chunk. */}
                <Toaster theme="dark" position="top-center" richColors />
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
