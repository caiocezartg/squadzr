import type { ReactNode } from 'react'
import { LandingFooter } from '@/components/landing/landing-footer'

/**
 * The layout of the legal pages: public pages with no sidebar, like the landing, above the landing's
 * footer. Each page brings its own header (see LegalPage), so a move between them starts at the top of
 * the page, where the App Router scrolls to the changed segment.
 */
export default function LegalLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div id="root" className="bg-bg flex min-h-screen flex-col">
      <div className="flex-1">{children}</div>
      <LandingFooter />
    </div>
  )
}
