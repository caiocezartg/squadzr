'use client'

import * as m from 'motion/react-m'
import { useNow } from 'next-intl'
import { SquadCard } from '@/features/squad-list'
import type { Game, Squad } from '@/types'

interface ShowcaseItem {
  readonly squad: Squad
  readonly game: Game
  readonly floatAmount: number
  readonly floatDuration: number
  readonly floatDelay: number
}

const MINUTE_MS = 60_000

/**
 * The sample Squads, timed from `now`, the time next-intl hands to the client. Their relative times
 * are the same in the server HTML and in the browser, and they do not depend on when the module loaded.
 */
function sampleSquads(now: Date): ShowcaseItem[] {
  const nowIso = now.toISOString()
  const minutesAgo = (minutes: number) =>
    new Date(now.getTime() - minutes * MINUTE_MS).toISOString()
  const sampleGame = (id: string, name: string, slug: string, coverUrl: string): Game => ({
    id,
    name,
    slug,
    genres: [],
    coverUrl,
    coverThumbUrl: coverUrl,
    minPlayers: 2,
    maxPlayers: 5,
    createdAt: nowIso,
    updatedAt: nowIso,
  })

  return [
    {
      floatAmount: 6,
      floatDuration: 6.5,
      floatDelay: 0,
      game: sampleGame(
        'g1',
        'League of Legends',
        'lol',
        'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co49wj.webp'
      ),
      squad: {
        id: 's1',
        code: 'ABC12',
        name: 'Ranked climbing - Gold+',
        hostId: 'u1',
        gameId: 'g1',
        maxPlayers: 5,
        discordLink: null,
        tags: ['ranked', 'chill'],
        language: 'en',
        memberCount: 3,
        isMember: false,
        createdAt: minutesAgo(8),
        updatedAt: nowIso,
      },
    },
    {
      floatAmount: 8,
      floatDuration: 7.2,
      floatDelay: 1.0,
      game: sampleGame(
        'g2',
        'Counter-Strike 2',
        'cs2',
        'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaczd.webp'
      ),
      squad: {
        id: 's2',
        code: 'XYZ99',
        name: 'Competitive 5v5 tryhard',
        hostId: 'u2',
        gameId: 'g2',
        maxPlayers: 5,
        discordLink: null,
        tags: ['competitive'],
        language: 'pt-br',
        memberCount: 4,
        isMember: false,
        createdAt: minutesAgo(3),
        updatedAt: nowIso,
      },
    },
    {
      floatAmount: 5,
      floatDuration: 8.0,
      floatDelay: 2.2,
      game: sampleGame(
        'g3',
        'Dota 2',
        'dota2',
        'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cobfk4.webp'
      ),
      squad: {
        id: 's3',
        code: 'QWE34',
        name: 'Fun match no stress',
        hostId: 'u3',
        gameId: 'g3',
        maxPlayers: 5,
        discordLink: null,
        tags: ['casual', 'fun'],
        language: 'en',
        memberCount: 2,
        isMember: false,
        createdAt: minutesAgo(15),
        updatedAt: nowIso,
      },
    },
  ]
}

/**
 * The floating sample Squads of the hero. The cards are visible from the first paint, so the
 * motion only decorates them: each card drifts up and down on its own cycle.
 */
export function HeroSquadShowcase() {
  const now = useNow()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pointer-events-none">
      {sampleSquads(now).map(({ squad, game, floatAmount, floatDuration, floatDelay }) => (
        <m.div
          key={squad.id}
          animate={{ y: [0, -floatAmount, 0] }}
          transition={{
            duration: floatDuration,
            repeat: Infinity,
            ease: [0.45, 0, 0.55, 1],
            delay: floatDelay,
          }}
        >
          <SquadCard squad={squad} game={game} />
        </m.div>
      ))}
    </div>
  )
}
