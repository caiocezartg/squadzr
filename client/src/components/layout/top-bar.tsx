'use client'

import { AppLink } from './app-link'
import { MobileDrawer } from './mobile-drawer'
import { NotificationsBell } from './notifications-bell'
import { useTranslations } from 'next-intl'

/**
 * The bar below 1024px: the logo, the bell and the button that opens the sidebar as a drawer. It is
 * the only place of the bell at these widths, so the page header has none.
 */
export function TopBar() {
  const t = useTranslations('ds.shell')

  return (
    <header className="bg-menu sticky top-0 z-30 flex h-14 items-center justify-between pr-2 pl-4 shadow-[inset_0_-1px_0_#16171b] lg:hidden">
      <AppLink href="/" aria-label={t('home')} className="block">
        <img src="/squadzr-logo.svg" alt="" className="block w-24" />
      </AppLink>
      <div className="flex items-center gap-1">
        <NotificationsBell placement="top-bar" />
        <MobileDrawer />
      </div>
    </header>
  )
}
