import type { Metadata } from 'next'
import { Exo_2, Plus_Jakarta_Sans } from 'next/font/google'
import type { ReactNode } from 'react'
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${exo2.variable} ${plusJakartaSans.variable}`}>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
