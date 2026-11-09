'use client'

import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { cn } from '@/lib/utils'
import { ADMIN_CATALOG_RUNS_HREF, ADMIN_GAMES_HREF } from './games/game-links'

/** A tab of the Catalog page; the URL holds which one is open. */
export type CatalogTab = 'games' | 'runs'

const TABS: readonly { readonly tab: CatalogTab; readonly href: string }[] = [
  { tab: 'games', href: ADMIN_GAMES_HREF },
  { tab: 'runs', href: ADMIN_CATALOG_RUNS_HREF },
]

/**
 * The Catalog page's tabs, Games then Import runs, as links: each tab is its own address, so the
 * current one is marked as the page and the keyboard moves between them with Tab like any link.
 */
export function CatalogTabs({ current }: { readonly current: CatalogTab }) {
  const t = useTranslations('admin.catalog.tabs')

  return (
    <nav aria-label={t('label')} className="shadow-[inset_0_-1px_0_var(--color-line)]">
      <ul className="flex gap-1">
        {TABS.map(({ tab, href }) => {
          const selected = tab === current
          return (
            <li key={tab}>
              <AppLink
                href={href}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'focus-visible:outline-mint -mb-px block border-b-2 px-3.5 py-2.5 text-sm font-bold focus-visible:outline-2 focus-visible:-outline-offset-2',
                  selected
                    ? 'border-mint text-text'
                    : 'text-muted hover-fine:text-text border-transparent'
                )}
              >
                {t(tab)}
              </AppLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
