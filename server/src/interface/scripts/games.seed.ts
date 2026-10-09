import { loadDatabaseEnv } from '@config/env'
import { createDatabase } from '@infrastructure/database/drizzle'
import { seedGames } from '@infrastructure/database/seed/games.seed'
import { createGameRepository } from '@interface/factories/game.factory'

/** Composes the games seed: DATABASE_URL is the only configuration it reads. */
async function seed() {
  const { DATABASE_URL } = loadDatabaseEnv()
  const { db, close } = createDatabase(DATABASE_URL)

  await seedGames(createGameRepository(db))
  await close()
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
