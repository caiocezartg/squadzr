'use client'

import { UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import type { Player, PublicSquad } from '@/types'
import { ExploreSquadsButton } from './explore-squads-button'
import { LobbyCover } from './lobby-cover'
import { LockedInvite } from './discord-invite'
import { MembersPanel } from './members-panel'

interface NonMemberLobbyProps {
  /** The Squad's public projection: everything a viewer outside it may know. */
  squad: PublicSquad
  viewerId: string
  /** A join request is in flight. */
  joining: boolean
  onJoin: () => void
}

/** The members the public projection names, as the tiles draw them: the host is the Squad's own. */
function previewPlayers(squad: PublicSquad): Player[] {
  return squad.memberPreview.map((member) => ({ ...member, isHost: member.id === squad.hostId }))
}

/**
 * The Lobby of a signed-in viewer who is not in the Squad (reference, Lobby): the cover, the counter, the
 * member preview and the open slots, the locked invite, and the way in. It is built from the public
 * projection alone. It has no Presence and no live channel, and the invite never leaves its lock.
 */
export function NonMemberLobby({ squad, viewerId, joining, onJoin }: NonMemberLobbyProps) {
  const t = useTranslations('ds.lobby')
  const players = previewPlayers(squad)

  return (
    <div className="flex flex-col gap-5 px-4 pt-6.5 pb-12 sm:px-6 lg:px-10">
      <div className="@container">
        <div className="flex items-center justify-between gap-2">
          <ExploreSquadsButton />
          <Button icon={<UserPlus />} disabled={joining} aria-busy={joining} onClick={onJoin}>
            {t('joinSquad')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        <LobbyCover squad={squad} />
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <MembersPanel
            key={squad.code}
            squadCode={squad.code}
            players={players}
            memberCount={squad.memberCount ?? players.length}
            maxPlayers={squad.maxPlayers}
            presence={null}
            viewerId={viewerId}
            isReady={false}
          />
          <LockedInvite />
        </div>
      </div>
    </div>
  )
}
