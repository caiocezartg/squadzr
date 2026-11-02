import type { ReactNode } from 'react'

/** The mint mono label above a landing section's title. */
export function SectionEyebrow({ children }: { readonly children: ReactNode }) {
  return (
    <span className="font-mono text-mint text-xs font-bold tracking-[0.16em] uppercase">
      {children}
    </span>
  )
}
