import * as motion from 'motion/react-client'
import { RoomCard } from '@/components/rooms/room-card'
import type { Room, Game } from '@/types'

type ShowcaseItem = {
  room: Room
  game: Game
  entryDelay: number
  floatAmount: number
  floatDuration: number
  floatDelay: number
}

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    entryDelay: 0.55,
    floatAmount: 6,
    floatDuration: 6.5,
    floatDelay: 0,
    game: {
      id: 'g1',
      name: 'League of Legends',
      slug: 'lol',
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co49wj.webp',
      minPlayers: 2,
      maxPlayers: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    room: {
      id: 'r1',
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
      createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    entryDelay: 0.7,
    floatAmount: 8,
    floatDuration: 7.2,
    floatDelay: 1.0,
    game: {
      id: 'g2',
      name: 'Counter-Strike 2',
      slug: 'cs2',
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaczd.webp',
      minPlayers: 2,
      maxPlayers: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    room: {
      id: 'r2',
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
      createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    entryDelay: 0.85,
    floatAmount: 5,
    floatDuration: 8.0,
    floatDelay: 2.2,
    game: {
      id: 'g3',
      name: 'Dota 2',
      slug: 'dota2',
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cobfk4.webp',
      minPlayers: 2,
      maxPlayers: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    room: {
      id: 'r3',
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
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
]

export function HeroRoomShowcase() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pointer-events-none">
      {SHOWCASE_ITEMS.map(({ room, game, entryDelay, floatAmount, floatDuration, floatDelay }) => (
        <motion.div
          key={room.id}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: entryDelay, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            animate={{ y: [0, -floatAmount, 0] }}
            transition={{
              duration: floatDuration,
              repeat: Infinity,
              ease: [0.45, 0, 0.55, 1],
              delay: floatDelay,
            }}
          >
            <RoomCard room={room} game={game} currentMembers={room.memberCount} />
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}
