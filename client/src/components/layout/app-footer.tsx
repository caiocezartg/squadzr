'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface AppFooterProps {
  /** The year of the request, read by the root layout on the server. */
  readonly year: number
}

/**
 * The shell footer. The landing renders its own footer, so the shell's stays off `/`. The path is the
 * same on the server and in the browser, so the server HTML and the first browser render agree.
 */
export function AppFooter({ year }: AppFooterProps) {
  const t = useTranslations()
  const pathname = usePathname()

  if (pathname === '/') return null

  return (
    <footer className="border-t border-border/50 py-6">
      <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted sm:px-6 lg:px-8">
        {t('footer.line', { year })}
      </div>
    </footer>
  )
}
