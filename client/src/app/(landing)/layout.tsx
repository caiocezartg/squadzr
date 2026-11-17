import { Anton } from 'next/font/google'
import type { ReactNode } from 'react'

// The hero headline's family (docs/design/reference.md, Typography). Only the landing uses it, so only
// the landing loads it.
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
  fallback: ['Impact', 'sans-serif'],
})

/** The layout of the landing: its own page, with no sidebar. The landing's sections carry their own chrome. */
export default function LandingLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div id="root" className={`bg-bg min-h-screen ${anton.variable}`}>
      <main>{children}</main>
    </div>
  )
}
