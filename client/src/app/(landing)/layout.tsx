import type { ReactNode } from 'react'

/** The layout of the landing: its own page, with no sidebar. The landing's sections carry their own chrome. */
export default function LandingLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div id="root" className="bg-background min-h-screen">
      <main>{children}</main>
    </div>
  )
}
