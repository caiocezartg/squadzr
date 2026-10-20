import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'

/** The Lobby's way back to the Squad Board, shown in every state that has the Lobby's header. */
export function LobbyBackLink() {
  const t = useTranslations()

  return (
    <AppLink
      href="/squads"
      className="flex w-fit items-center gap-2 rounded-lg border border-border-light bg-surface px-4 py-2 text-sm text-muted hover:border-muted/30 hover:bg-surface-hover hover:text-offwhite transition-all"
    >
      <ArrowLeft className="size-4" />
      {t('rooms.lobby.backToRooms')}
    </AppLink>
  )
}
