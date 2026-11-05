import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { PROFILE_TOP_GAMES_LIMIT, playerProfileResponseSchema } from '@squadzr/schemas'
import { games, squadRecordMembers, squadRecords } from '@infrastructure/database/schema'
import { DrizzleSquadRecordRepository } from '@infrastructure/repositories/drizzle-squad-record.repository'
import { signIn, type TestUser } from '@test/harness/auth'
import { createRoom, get, insertGame, joinAll } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #114: the public Player Profile, from the Squad Records up to GET /api/users/:id/profile.

let server: TestServer
let repository: DrizzleSquadRecordRepository

beforeEach(async () => {
  server = await buildTestServer()
  repository = new DrizzleSquadRecordRepository(server.app.db)
})

afterEach(async () => {
  await server.close()
})

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 12, minutes))

/** A Squad Record straight in the table, with the given people as members. */
async function recordSquad(gameId: string, readyAt: Date, ...members: TestUser[]): Promise<void> {
  const [record] = await server.app.db
    .insert(squadRecords)
    .values({
      roomId: randomUUID(),
      gameId,
      name: 'Squad',
      hostId: members[0]?.id ?? null,
      maxPlayers: members.length,
      readyAt,
    })
    .returning({ id: squadRecords.id })
  await server.app.db
    .insert(squadRecordMembers)
    .values(
      members.map((member) => ({ recordId: record!.id, userId: member.id, joinedAt: readyAt }))
    )
}

async function gameNamed(name: string) {
  return insertGame(server, { name, slug: name.toLowerCase().replaceAll(' ', '-') })
}

describe('getPlayerStats', () => {
  it('is empty for a person with no completed Squad', async () => {
    const player = await signIn(server)

    expect(await repository.getPlayerStats(player.id, PROFILE_TOP_GAMES_LIMIT)).toEqual({
      completedSquads: 0,
      gamesPlayed: 0,
      lastSquad: null,
      topGames: [],
    })
  })

  it('orders by Squads, then by the latest Ready, then by Game name', async () => {
    const player = await signIn(server)
    const [alpha, beta, gamma, delta] = await Promise.all(
      ['Alpha', 'Beta', 'Gamma', 'Delta'].map(gameNamed)
    )
    // Delta leads with 3 Squads. Beta and Gamma tie on 2: Gamma's latest is newer.
    // Alpha has 1 and closes the list.
    await recordSquad(delta!.id, at(1), player)
    await recordSquad(delta!.id, at(2), player)
    await recordSquad(delta!.id, at(3), player)
    await recordSquad(beta!.id, at(4), player)
    await recordSquad(beta!.id, at(5), player)
    await recordSquad(gamma!.id, at(6), player)
    await recordSquad(gamma!.id, at(7), player)
    await recordSquad(alpha!.id, at(8), player)

    const stats = await repository.getPlayerStats(player.id, PROFILE_TOP_GAMES_LIMIT)

    expect(stats.topGames.map((entry) => [entry.game.name, entry.squads])).toEqual([
      ['Delta', 3],
      ['Gamma', 2],
      ['Beta', 2],
      ['Alpha', 1],
    ])
    expect(stats.topGames[1]!.lastReadyAt).toEqual(at(7))
    expect(stats.completedSquads).toBe(8)
    expect(stats.gamesPlayed).toBe(4)
    expect(stats.lastSquad).toEqual({
      game: expect.objectContaining({ id: alpha!.id, name: 'Alpha' }),
      readyAt: at(8),
    })
  })

  it('breaks a full tie by Game name, ascending', async () => {
    const player = await signIn(server)
    const [zulu, mike] = await Promise.all(['Zulu', 'Mike'].map(gameNamed))
    await recordSquad(zulu!.id, at(1), player)
    await recordSquad(mike!.id, at(1), player)

    const stats = await repository.getPlayerStats(player.id, PROFILE_TOP_GAMES_LIMIT)

    expect(stats.topGames.map((entry) => entry.game.name)).toEqual(['Mike', 'Zulu'])
  })

  it('lists at most the limit while the totals count every Game', async () => {
    const player = await signIn(server)
    const catalog = await Promise.all(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name) => gameNamed(`Game ${name}`))
    )
    for (const [index, game] of catalog.entries()) {
      await recordSquad(game.id, at(index), player)
    }

    const stats = await repository.getPlayerStats(player.id, PROFILE_TOP_GAMES_LIMIT)

    expect(stats.topGames).toHaveLength(PROFILE_TOP_GAMES_LIMIT)
    expect(stats.gamesPlayed).toBe(7)
    expect(stats.completedSquads).toBe(7)
  })

  it('counts only the Squads the person is a member of', async () => {
    const [player, other] = await Promise.all([signIn(server), signIn(server)])
    const game = await gameNamed('Shared')
    await recordSquad(game.id, at(1), player, other)
    await recordSquad(game.id, at(2), other)

    expect((await repository.getPlayerStats(player.id, 5)).completedSquads).toBe(1)
    expect((await repository.getPlayerStats(other.id, 5)).completedSquads).toBe(2)
  })

  it('keeps a Game that left the catalog', async () => {
    const player = await signIn(server)
    const game = await gameNamed('Retired')
    await recordSquad(game.id, at(1), player)
    await server.app.db.update(games).set({ listed: false }).where(eq(games.id, game.id))

    const stats = await repository.getPlayerStats(player.id, 5)

    expect(stats.topGames.map((entry) => entry.game.name)).toEqual(['Retired'])
  })

  it('ignores Squads that are still open', async () => {
    const [host, member] = await Promise.all([signIn(server), signIn(server)])
    const game = await insertGame(server)
    const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 3 })
    await joinAll(server, room.code, [member])

    expect((await repository.getPlayerStats(host.id, 5)).completedSquads).toBe(0)
    expect((await repository.getPlayerStats(member.id, 5)).completedSquads).toBe(0)
  })
})

describe('GET /api/users/:id/profile', () => {
  it('answers without a session, in the profile order, never leaking the email', async () => {
    const player = await signIn(server, 'Caio')
    const [alpha, beta] = await Promise.all([gameNamed('Alpha'), gameNamed('Beta')])
    await recordSquad(beta!.id, at(1), player)
    await recordSquad(beta!.id, at(2), player)
    await recordSquad(alpha!.id, at(3), player)

    const response = await get(server, `/api/users/${player.id}/profile`)

    expect(response.statusCode).toBe(200)
    const { profile } = playerProfileResponseSchema.parse(response.json())
    expect(profile).toMatchObject({
      id: player.id,
      name: 'Caio',
      image: player.image,
      completedSquads: 3,
      gamesPlayed: 2,
    })
    expect(profile.topGames.map((entry) => [entry.game.name, entry.squads])).toEqual([
      ['Beta', 2],
      ['Alpha', 1],
    ])
    expect(profile.lastSquad).toEqual({
      game: expect.objectContaining({ name: 'Alpha' }),
      readyAt: at(3).toISOString(),
    })
    expect(response.body).not.toContain(player.email)
    expect(response.json<{ profile: object }>().profile).not.toHaveProperty('email')
  })

  it('returns an empty history for a person who never completed a Squad', async () => {
    const player = await signIn(server)

    const response = await get(server, `/api/users/${player.id}/profile`)

    expect(response.statusCode).toBe(200)
    expect(playerProfileResponseSchema.parse(response.json()).profile).toMatchObject({
      completedSquads: 0,
      gamesPlayed: 0,
      lastSquad: null,
      topGames: [],
    })
  })

  it('lists at most five Games', async () => {
    const player = await signIn(server)
    for (const [index, name] of ['A', 'B', 'C', 'D', 'E', 'F'].entries()) {
      await recordSquad((await gameNamed(`Game ${name}`)).id, at(index), player)
    }

    const response = await get(server, `/api/users/${player.id}/profile`)

    const { profile } = playerProfileResponseSchema.parse(response.json())
    expect(profile.topGames).toHaveLength(5)
    expect(profile.gamesPlayed).toBe(6)
  })

  it('shows a Game that left the catalog', async () => {
    const player = await signIn(server)
    const game = await gameNamed('Retired')
    await recordSquad(game.id, at(1), player)
    await server.app.db.update(games).set({ listed: false }).where(eq(games.id, game.id))

    const response = await get(server, `/api/users/${player.id}/profile`)

    expect(playerProfileResponseSchema.parse(response.json()).profile.topGames).toHaveLength(1)
  })

  it('answers 404 USER_NOT_FOUND for an unknown id', async () => {
    const response = await get(server, '/api/users/nobody/profile')

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'USER_NOT_FOUND' })
  })

  it('answers 400 for an id longer than 255 characters', async () => {
    const response = await get(server, `/api/users/${'a'.repeat(256)}/profile`)

    expect(response.statusCode).toBe(400)
  })
})
