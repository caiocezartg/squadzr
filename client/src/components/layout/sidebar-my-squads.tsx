'use client'

import { useId, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SidebarSquadItem } from '@/components/ds/sidebar-squad-item'
import { useMySquads, useMySquadsEvents } from '@/features/my-squads'
import { useSession } from '@/hooks/use-session'
import { useWebSocket } from '@/hooks/use-websocket'
import { WS_URL } from '@/env'
import { lobbyHref } from '@/lib/squad-links'

interface SidebarMySquadsProps {
  /** Called when the viewer picks a squad, so a drawer can close. */
  readonly onNavigate?: () => void
}

/**
 * The viewer's squads, between "All squads" and the account controls (reference, Components, Sidebar):
 * the Squads they host or joined, newest first. A visitor has none, so the section is left out: the
 * account button below already offers the sign-in. The section takes the room left in the column, and
 * only its list scrolls, so the controls stay at the foot.
 */
export function SidebarMySquads({ onNavigate }: SidebarMySquadsProps) {
  const headingId = useId()
  const session = useSession()
  const userId = session?.user?.id

  if (!userId) return null

  return (
    <section aria-labelledby={headingId} className="flex min-h-0 flex-1 flex-col gap-2.5">
      <MySquadsList headingId={headingId} userId={userId} onNavigate={onNavigate} />
    </section>
  )
}

function MySquadsList({
  headingId,
  userId,
  onNavigate,
}: {
  readonly headingId: string
  readonly userId: string
  readonly onNavigate?: () => void
}) {
  const t = useTranslations('ds.shell')
  const pathname = usePathname()
  const squads = useMySquads()
  const { subscribe } = useWebSocket(WS_URL)
  const squadIds = useMemo(() => squads.map((squad) => squad.id), [squads])

  useMySquadsEvents({ squadIds, subscribe })

  return (
    <>
      <h2 id={headingId} className="type-label text-muted px-2">
        {t('mySquads')}
      </h2>
      <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
        {squads.map((squad) => {
          const href = lobbyHref(squad.code)
          const filled = squad.memberCount ?? 1

          return (
            <SidebarSquadItem
              key={squad.id}
              href={href}
              name={squad.name}
              coverUrl={squad.game.coverUrl}
              filled={filled}
              total={squad.maxPlayers}
              host={squad.hostId === userId}
              ready={squad.memberCount === squad.maxPlayers}
              current={pathname.toLowerCase() === href.toLowerCase()}
              onNavigate={onNavigate}
            />
          )
        })}
      </div>
    </>
  )
}
