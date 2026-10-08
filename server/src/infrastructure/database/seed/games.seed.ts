import type { IGameRepository } from '@domain/repositories/game.repository'

export const GAMES_DATA = [
  {
    name: 'Roblox',
    slug: 'roblox',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coabhb.webp',
    minPlayers: 2,
    maxPlayers: 50,
  },
  {
    name: 'Minecraft',
    slug: 'minecraft',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co49x5.webp',
    minPlayers: 2,
    maxPlayers: 10,
  },
  {
    name: 'Counter-Strike 2',
    slug: 'cs2',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaczd.webp',
    minPlayers: 2,
    maxPlayers: 5,
  },
  {
    name: 'Fortnite',
    slug: 'fortnite',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaxt6.webp',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    name: 'Dota 2',
    slug: 'dota2',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cobfk4.webp',
    minPlayers: 2,
    maxPlayers: 5,
  },
  {
    name: 'League of Legends',
    slug: 'lol',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co49wj.webp',
    minPlayers: 2,
    maxPlayers: 5,
  },
  {
    name: 'PUBG: Battlegrounds',
    slug: 'pubg',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaam4.webp',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    name: 'Free Fire',
    slug: 'freefire',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co52c7.webp',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    name: 'Valorant',
    slug: 'valorant',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2mvt.webp',
    minPlayers: 2,
    maxPlayers: 5,
  },
  {
    name: 'Call of Duty: Warzone',
    slug: 'warzone',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coa8id.webp',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    name: 'Apex Legends',
    slug: 'apex',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coa93z.webp',
    minPlayers: 2,
    maxPlayers: 3,
  },
  {
    name: 'GTA Online',
    slug: 'gtaonline',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4rq1.webp',
    minPlayers: 2,
    maxPlayers: 30,
  },
  {
    name: 'Rocket League',
    slug: 'rocketleague',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co5w0w.webp',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    name: 'Rainbow Six Siege',
    slug: 'r6siege',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co9yqs.webp',
    minPlayers: 2,
    maxPlayers: 5,
  },
  {
    name: 'Among Us',
    slug: 'amongus',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co6kqt.webp',
    minPlayers: 4,
    maxPlayers: 15,
  },
  {
    name: 'Overwatch',
    slug: 'overwatch2',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cobfow.webp',
    minPlayers: 2,
    maxPlayers: 5,
  },
  {
    name: 'World of Warcraft',
    slug: 'wow',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2l7z.webp',
    minPlayers: 2,
    maxPlayers: 40,
  },
  {
    name: 'EA Sports FC',
    slug: 'fc25',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coa5wx.webp',
    minPlayers: 2,
    maxPlayers: 22,
  },
  {
    name: 'Dead by Daylight',
    slug: 'dbd',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co5zky.webp',
    minPlayers: 2,
    maxPlayers: 5,
  },
]

/** Upserts the catalog by slug: running it again refreshes the rows instead of duplicating them. */
export async function seedGames(gameRepository: IGameRepository): Promise<void> {
  console.log('Seeding games...')

  for (const game of GAMES_DATA) {
    await gameRepository.upsertBySlug(game)
    console.log(`  ✓ ${game.name}`)
  }

  console.log('Done seeding games!')
}
