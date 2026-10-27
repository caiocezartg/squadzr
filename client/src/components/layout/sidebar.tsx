'use client'

import { LayoutGrid, Plus } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { OpenSquadCount } from '@/features/squad-board'
import { cn } from '@/lib/utils'
import { AppLink } from './app-link'
import { useCreateSquadLauncher } from './create-squad-launcher'
import { LanguageToggle } from './language-toggle'
import { SidebarCodeForm } from './sidebar-code-form'
import { SidebarMySquads } from './sidebar-my-squads'
import { UserMenu } from './user-menu'

interface SidebarContentProps {
  /** Called when the viewer picks something that leaves the sidebar's place, so a drawer can close. */
  readonly onNavigate?: () => void
}

/**
 * What the sidebar holds, top to bottom (reference, Components, Sidebar): the logo, "Create squad",
 * the join-by-code form, "All squads" with its count, the viewer's squads, the language switch and the
 * account button. The fixed column and the drawer both render it.
 */
export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const t = useTranslations('ds.shell')
  const pathname = usePathname()
  const { requestCreate } = useCreateSquadLauncher()
  const onBoard = pathname === '/squads'

  return (
    <div className="flex h-full flex-col gap-6.5 px-4 pt-6 pb-5">
      <AppLink
        href="/"
        aria-label={t('home')}
        onClick={onNavigate}
        className="block self-start px-2"
      >
        <img src="/squadzr-logo.svg" alt="" className="block w-26" />
      </AppLink>

      <div className="flex flex-col gap-2">
        <Button
          full
          icon={<Plus />}
          onClick={() => {
            onNavigate?.()
            requestCreate()
          }}
        >
          {t('createSquad')}
        </Button>
        <SidebarCodeForm onNavigate={onNavigate} />
      </div>

      <nav aria-label={t('squads')} className="flex flex-col gap-0.5">
        {/* The current item has no transition: it takes its ground and edge the moment the page does. */}
        <AppLink
          href="/squads"
          onClick={onNavigate}
          aria-current={onBoard ? 'page' : undefined}
          className={cn(
            'type-ui focus-visible:outline-mint flex min-h-11 items-center gap-3 p-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2',
            onBoard
              ? 'bg-raised text-text shadow-[inset_2px_0_0_var(--color-mint)]'
              : 'text-text-3 hover-fine:bg-card hover-fine:text-text'
          )}
        >
          <LayoutGrid aria-hidden className="size-4.25 shrink-0" strokeWidth={2.2} />
          {t('allSquads')}
          <OpenSquadCount className="font-ds-mono text-text-3 ml-auto text-[11px] font-bold" />
        </AppLink>
      </nav>

      <SidebarMySquads onNavigate={onNavigate} />

      <div className="flex flex-col gap-2.5">
        <LanguageToggle />
        <UserMenu />
      </div>
    </div>
  )
}

/** The sidebar of 1024px and up: a fixed 260px column. Below that the drawer takes its place. */
export function Sidebar() {
  const t = useTranslations('ds.shell')

  return (
    <aside
      aria-label={t('menu')}
      className="bg-menu fixed inset-y-0 left-0 z-30 hidden w-65 overflow-y-auto shadow-[inset_-1px_0_0_#16171b] lg:block"
    >
      <SidebarContent />
    </aside>
  )
}
