'use client'

import { useState } from 'react'
import * as m from 'motion/react-m'
import { Check, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { CopySwap } from '@/components/ds/copy-swap'
import { MemberTile } from '@/components/ds/member-tile'
import { Pagination } from '@/components/ds/pagination'
import { SlotMeter } from '@/components/ds/slot-meter'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import type { Player } from '@/types'
import type { PresenceState } from '../squad-snapshot'
import { useCopiedFlag } from '../use-copied-flag'
import { useRosterArrivals } from '../use-roster-arrivals'
import { RosterCounter } from './roster-counter'

/** Member tiles per page of the members panel (reference, Lobby). */
const TILES_PER_PAGE = 8

/** A member who joins while the viewer watches: from `opacity 0; scale(0.9)` with a spring. */
const ArrivingMemberTile = m.create(MemberTile)

const ARRIVAL_FROM = { opacity: 0, transform: 'scale(0.9)' }
const ARRIVAL_TO = { opacity: 1, transform: 'scale(1)' }
const ARRIVAL_SPRING = {
  type: 'spring',
  duration: 0.4,
  bounce: 0.15,
  opacity: { duration: 0.2, ease: 'easeOut' },
} as const
/** Under reduced motion only the fade remains. */
const ARRIVAL_FADE = { duration: 0.2, ease: 'easeOut' } as const

interface MembersPanelProps {
  squadCode: string
  players: readonly Player[]
  maxPlayers: number
  presence: PresenceState
  viewerId: string
  isReady: boolean
}

/**
 * The members panel (reference, Lobby): the counter, the copyable code, the blocks meter and the member
 * tiles, eight to a page. The order is the server's: the host first, then by join time. Open slots follow
 * the members.
 */
export function MembersPanel({
  squadCode,
  players,
  maxPlayers,
  presence,
  viewerId,
  isReady,
}: MembersPanelProps) {
  const t = useTranslations('ds.lobby')
  const reducedMotion = useReducedMotion()
  const [codeCopied, markCodeCopied] = useCopiedFlag()
  const { live, arrivals } = useRosterArrivals(players)
  const [requestedPage, setPage] = useState(1)

  const slots = Math.max(maxPlayers, players.length)
  const pageCount = Math.ceil(slots / TILES_PER_PAGE)
  const page = Math.min(requestedPage, pageCount)
  const first = (page - 1) * TILES_PER_PAGE
  const visibleMembers = players.slice(first, first + TILES_PER_PAGE)
  const openSlots = Math.max(
    0,
    Math.min(first + TILES_PER_PAGE, slots) - first - visibleMembers.length
  )

  const copyCode = async () => {
    await navigator.clipboard.writeText(squadCode)
    markCodeCopied()
  }

  return (
    <section
      aria-labelledby="lobby-members-heading"
      className="bg-panel flex min-w-0 flex-1 flex-col gap-4.5 px-4 pt-5.5 pb-4.5 sm:px-5.5"
    >
      <h2 id="lobby-members-heading" className="sr-only">
        {t('members')}
      </h2>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <RosterCounter current={players.length} max={maxPlayers} live={live} ready={isReady} />
        <div className="flex flex-col items-end gap-2.5 pb-0.5">
          <Button
            variant="secondary"
            size="sm"
            mono
            aria-label={codeCopied ? t('copied') : t('copyCode', { code: squadCode })}
            onClick={() => void copyCode()}
          >
            <CopySwap
              copied={codeCopied}
              idle={
                <>
                  #{squadCode}
                  <Copy className="size-3.25 stroke-[2.6]" />
                </>
              }
              done={
                <>
                  {t('copied')}
                  <Check className="size-3.25 stroke-[2.6]" />
                </>
              }
            />
          </Button>
          <SlotMeter filled={players.length} total={maxPlayers} />
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {visibleMembers.map((player) => {
          const memberPresence = presence[player.id]
          const tile = {
            playerId: player.id,
            name: player.name,
            image: player.image,
            host: player.isHost,
            you: player.id === viewerId,
            online: memberPresence?.online ?? false,
            offlineSince: memberPresence?.offlineSince ?? null,
          }

          const arriving = arrivals.has(player.id)

          // Every member is the same component, so a tile never remounts when it stops being an arrival. Only an arrival starts from the entrance state; the rest render in their final state.
          return (
            <ArrivingMemberTile
              key={player.id}
              {...tile}
              initial={arriving ? (reducedMotion ? { opacity: 0 } : ARRIVAL_FROM) : false}
              animate={reducedMotion ? { opacity: 1 } : ARRIVAL_TO}
              transition={reducedMotion ? ARRIVAL_FADE : ARRIVAL_SPRING}
            />
          )
        })}
        {Array.from({ length: openSlots }, (_, index) => (
          <MemberTile key={`open-${first + visibleMembers.length + index}`} open />
        ))}
      </ul>

      <div className="grow" />
      <Pagination
        tone="light"
        size="sm"
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        className="justify-end"
      />
    </section>
  )
}
