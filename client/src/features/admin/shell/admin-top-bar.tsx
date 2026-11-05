'use client'

import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { MobileDrawer } from '@/components/layout/mobile-drawer'
import { AdminBadge, AdminSidebarContent } from './admin-sidebar'

/**
 * The admin bar below 1024px: the logo with the ADMIN mark and the button that opens the admin sidebar
 * as a drawer, with the app drawer's behaviour.
 */
export function AdminTopBar() {
  const t = useTranslations('admin')

  return (
    <header className="bg-menu sticky top-0 z-30 flex h-14 items-center justify-between pr-2 pl-4 shadow-[inset_0_-1px_0_#16171b] lg:hidden">
      <div className="flex items-center gap-2.5">
        <AppLink href="/" aria-label={t('home')} className="block">
          <img src="/squadzr-logo.svg" alt="" className="block w-24" />
        </AppLink>
        <AdminBadge />
      </div>
      <MobileDrawer>{(close) => <AdminSidebarContent onNavigate={close} />}</MobileDrawer>
    </header>
  )
}
