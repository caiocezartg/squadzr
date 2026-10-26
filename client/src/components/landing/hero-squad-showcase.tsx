'use client'

import * as m from 'motion/react-m'
import { SquadCard } from '@/features/squad-list'
import type { Squad } from '@/types'

interface ShowcaseItem {
  readonly squad: Squad
  readonly floatAmount: number
  readonly floatDuration: number
  readonly floatDelay: number
}

/** The members a sample Squad shows on its card: initials only, as a member without a Discord image. */
function sampleMembers(...names: string[]): Squad['memberPreview'] {
  return names.map((name) => ({ id: `sample-${name}`, name, image: null }))
}

/** The card shows no timestamp, so every sample shares one fixed time. */
const SAMPLE_TIME = '2026-01-01T00:00:00.000Z'

/** The sample Squads. Each carries its game summary, as every Squad the API sends does. */
function sampleSquads(): ShowcaseItem[] {
  const sampleGame = (id: string, name: string, slug: string, coverUrl: string): Squad['game'] => ({
    id,
    name,
    slug,
    genres: [],
    coverUrl,
    coverThumbUrl: coverUrl,
  })

  const lol = sampleGame(
    'g1',
    'League of Legends',
    'lol',
    'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co49wj.webp'
  )
  const cs2 = sampleGame(
    'g2',
    'Counter-Strike 2',
    'cs2',
    'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaczd.webp'
  )
  const dota = sampleGame(
    'g3',
    'Dota 2',
    'dota2',
    'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cobfk4.webp'
  )

  return [
    {
      floatAmount: 6,
      floatDuration: 6.5,
      floatDelay: 0,
      squad: {
        id: 's1',
        code: 'ABC12',
        name: 'Ranked climbing - Gold+',
        hostId: 'u1',
        gameId: 'g1',
        game: lol,
        maxPlayers: 5,
        discordLink: null,
        tags: ['ranked', 'chill'],
        language: 'en',
        memberCount: 3,
        memberPreview: sampleMembers('Caio Cezar', 'Mia Ferraz', 'Bruno Reis'),
        isMember: false,
        createdAt: SAMPLE_TIME,
        updatedAt: SAMPLE_TIME,
      },
    },
    {
      floatAmount: 8,
      floatDuration: 7.2,
      floatDelay: 1.0,
      squad: {
        id: 's2',
        code: 'XYZ99',
        name: 'Competitive 5v5 tryhard',
        hostId: 'u2',
        gameId: 'g2',
        game: cs2,
        maxPlayers: 5,
        discordLink: null,
        tags: ['competitive'],
        language: 'pt-br',
        memberCount: 4,
        memberPreview: sampleMembers('Kaz Ito', 'Luna Pires', 'Tales Aguiar', 'Jade Pons'),
        isMember: false,
        createdAt: SAMPLE_TIME,
        updatedAt: SAMPLE_TIME,
      },
    },
    {
      floatAmount: 5,
      floatDuration: 8.0,
      floatDelay: 2.2,
      squad: {
        id: 's3',
        code: 'QWE34',
        name: 'Fun match no stress',
        hostId: 'u3',
        gameId: 'g3',
        game: dota,
        maxPlayers: 5,
        discordLink: null,
        tags: ['casual', 'fun'],
        language: 'en',
        memberCount: 2,
        memberPreview: sampleMembers('Mia Ferraz', 'Bruno Reis'),
        isMember: false,
        createdAt: SAMPLE_TIME,
        updatedAt: SAMPLE_TIME,
      },
    },
  ]
}

/**
 * The floating sample Squads of the hero. The cards are visible from the first paint, so the
 * motion only decorates them: each card drifts up and down on its own cycle.
 */
export function HeroSquadShowcase() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pointer-events-none">
      {sampleSquads().map(({ squad, floatAmount, floatDuration, floatDelay }) => (
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
          <SquadCard squad={squad} />
        </m.div>
      ))}
    </div>
  )
}
