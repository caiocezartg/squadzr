'use client'

import { useTranslations } from 'next-intl'
import { DiscordNotAffiliated } from '@/components/legal/discord-notices'
import { LegalLinks } from '@/components/legal/legal-links'

const LINK_CLASSES =
  'text-text-3 hover-fine:text-text focus-visible:outline-mint text-xs font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2'

/** The sidebar's foot: the legal links and the notice that Squadzr is not Discord. */
export function SidebarLegal({ onNavigate }: { readonly onNavigate?: () => void }) {
  const t = useTranslations('legal.links')

  return (
    <div className="flex flex-col gap-1.5 px-2">
      <nav aria-label={t('label')} className="flex flex-wrap gap-x-4 gap-y-1">
        <LegalLinks onNavigate={onNavigate} linkClassName={LINK_CLASSES} />
      </nav>
      <DiscordNotAffiliated className="text-[11px]" />
    </div>
  )
}
