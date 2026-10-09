import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { games } from '@infrastructure/database/schema'
import { DrizzleGameRepository } from '@infrastructure/repositories/drizzle-game.repository'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-61: upsertBySlug resolves its conflict inside PostgreSQL on the unique slug:
// one row per slug, catalog fields refreshed, identity and creation time kept.

const LOL = {
  name: 'League of Legends',
  slug: 'lol',
  coverUrl: 'https://cdn.squadzr.test/lol.webp',
  minPlayers: 2,
  maxPlayers: 5,
}

let server: TestServer
let repository: DrizzleGameRepository

beforeEach(async () => {
  server = await buildTestServer()
  repository = new DrizzleGameRepository(server.app.db)
})

afterEach(async () => {
  await server.close()
})

async function countRows(): Promise<number> {
  return (await server.app.db.select().from(games)).length
}

describe('DrizzleGameRepository.upsertBySlug', () => {
  it('inserts a game whose slug is new, next to the games already stored', async () => {
    await repository.upsertBySlug(LOL)
    const cs2 = await repository.upsertBySlug({ ...LOL, name: 'Counter-Strike 2', slug: 'cs2' })

    expect(cs2).toMatchObject({ name: 'Counter-Strike 2', slug: 'cs2' })
    expect(await countRows()).toBe(2)
  })

  it('updates the row on a slug conflict, keeping its id and creation time', async () => {
    const created = await repository.upsertBySlug(LOL)
    const before = new Date()

    const updated = await repository.upsertBySlug({
      name: 'League of Legends: Wild Rift',
      slug: 'lol',
      coverUrl: 'https://cdn.squadzr.test/wild-rift.webp',
      minPlayers: 1,
      maxPlayers: 6,
    })

    expect(updated).toMatchObject({
      id: created.id,
      slug: 'lol',
      name: 'League of Legends: Wild Rift',
      coverUrl: 'https://cdn.squadzr.test/wild-rift.webp',
      minPlayers: 1,
      maxPlayers: 6,
    })
    expect(updated.createdAt).toEqual(created.createdAt)
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(await countRows()).toBe(1)
  })

  it('keeps exactly one row when the same catalog entry is upserted again', async () => {
    const first = await repository.upsertBySlug(LOL)
    const second = await repository.upsertBySlug(LOL)

    expect(second.id).toBe(first.id)
    expect(await countRows()).toBe(1)
  })
})
