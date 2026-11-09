'use client'

import { ArrowUpRight, House } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { LanguageToggle } from '@/components/layout/language-toggle'
import { UserMenu } from '@/components/layout/user-menu'
import { useSession } from '@/hooks/use-session'
import { cn } from '@/lib/utils'
import { adminNavFor, isCurrentSection } from './admin-nav'

/** The mint ADMIN mark beside the logo, in the sidebar and in the top bar. */
export function AdminBadge({ className }: { readonly className?: string }) {
  const t = useTranslations('admin')

  return (
    <span
      className={cn(
        'type-label bg-mint text-mint-ink inline-block px-1.5 py-0.75 text-[10px] leading-none',
        className
      )}
    >
      {t('badge')}
    </span>
  )
}

interface AdminSidebarContentProps {
  /** Called when the viewer picks a link, so a drawer can close. */
  readonly onNavigate?: () => void
}

/**
 * What the admin sidebar holds, top to bottom (reference, Admin panel): the logo with the ADMIN mark,
 * the panel's sections the viewer opens, then past a thin line "Squad Board" (out of the panel, to the board), the
 * language switch and the account button. The fixed column and the drawer both render it.
 */
export function AdminSidebarContent({ onNavigate }: AdminSidebarContentProps) {
  const t = useTranslations('admin')
  const pathname = usePathname()
  const role = useSession()?.user.role

  return (
    <div className="flex h-full min-h-full flex-col px-4 pt-5.5 pb-5">
      <div className="flex flex-col items-start gap-3 px-2 pb-5">
        <AppLink href="/" aria-label={t('home')} onClick={onNavigate} className="block">
          <img src="/squadzr-logo.svg" alt="" className="block w-26" />
        </AppLink>
        <AdminBadge />
      </div>

      <nav aria-label={t('nav.label')} className="flex flex-col gap-1">
        {adminNavFor(role).map(({ href, label, icon: Icon }) => {
          const current = isCurrentSection(href, pathname)

          return (
            // The current item has no transition: it takes its ground and edge the moment the page does.
            <AppLink
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'type-ui focus-visible:outline-mint flex min-h-11 items-center gap-2.5 px-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2',
                current
                  ? 'bg-raised text-text shadow-[inset_2px_0_0_var(--color-mint)]'
                  : 'text-text-3 hover-fine:bg-card hover-fine:text-text'
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" strokeWidth={2.2} />
              {t(`nav.${label}`)}
            </AppLink>
          )
        })}
      </nav>

      {/* Out of the panel: the same row as a section, never current, with a glyph that says it leaves. */}
      <div className="mt-2 pt-2 shadow-[inset_0_1px_0_#16171b]">
        <AppLink
          href="/squads"
          onClick={onNavigate}
          className="type-ui text-text-3 hover-fine:bg-card hover-fine:text-text focus-visible:outline-mint flex min-h-11 items-center gap-2.5 px-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          <House aria-hidden className="size-4 shrink-0" strokeWidth={2.2} />
          {t('nav.board')}
          <ArrowUpRight aria-hidden className="ml-auto size-3.5 shrink-0" strokeWidth={2.4} />
        </AppLink>
      </div>

      <div className="mt-auto flex flex-col gap-2.5 pt-6">
        <LanguageToggle />
        <UserMenu />
      </div>
    </div>
  )
}

/** The admin sidebar of 1024px and up: a fixed 260px column, the board sidebar's width. Below that the drawer takes its place. */
export function AdminSidebar() {
  const t = useTranslations('admin')

  return (
    <aside
      aria-label={t('menu')}
      className="bg-menu fixed inset-y-0 left-0 z-30 hidden w-65 overflow-y-auto shadow-[inset_-1px_0_0_#16171b] lg:block"
    >
      <AdminSidebarContent />
    </aside>
  )
}
