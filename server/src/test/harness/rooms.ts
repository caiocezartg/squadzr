import { randomUUID } from 'node:crypto'
import { count, eq, sql } from 'drizzle-orm'
import type { LightMyRequestResponse } from 'fastify'
import { expect } from 'vitest'
import { roomSchema, type GameDto, type RoomDto } from '@squadzr/schemas'
import { games, roomMembers, rooms } from '@infrastructure/database/schema'
import type { TestUser } from './auth'
import type { TestServer } from './test-server'

export const DISCORD_INVITE = 'https://discord.gg/squadzr'

export async function insertGame(server: TestServer, maxPlayers = 5): Promise<GameDto> {
  const slug = `game-${randomUUID().slice(0, 8)}`
  const [game] = await server.app.db
    .insert(games)
    .values({
      name: `Game ${slug}`,
      slug,
      coverUrl: `https://cdn.squadzr.test/${slug}.webp`,
      minPlayers: 2,
      maxPlayers,
    })
    .returning()
  if (!game) throw new Error('Failed to insert game')
  // The row carries Date columns; the transport contract models them as ISO strings.
  return {
    ...game,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  }
}

export interface CreateRoomBody {
  name?: string
  gameId: string
  maxPlayers?: number
  discordLink?: string
  tags?: string[]
  language?: 'en' | 'pt-br'
}

export function postRoom(
  server: TestServer,
  host: TestUser | null,
  body: CreateRoomBody
): Promise<LightMyRequestResponse> {
  return server.app.inject({
    method: 'POST',
    url: '/api/rooms',
    headers: host?.headers,
    payload: { name: 'Ranked squad', discordLink: DISCORD_INVITE, ...body },
  })
}

/** Creates a room over HTTP and fails the test unless the API answers 201. */
export async function createRoom(
  server: TestServer,
  host: TestUser,
  body: CreateRoomBody
): Promise<RoomDto> {
  const response = await postRoom(server, host, body)
  expect(response.statusCode, response.body).toBe(201)
  return roomSchema.parse(response.json<{ room: unknown }>().room)
}

export function roomAction(
  server: TestServer,
  user: TestUser | null,
  code: string,
  action: 'join' | 'leave'
): Promise<LightMyRequestResponse> {
  return server.app.inject({
    method: 'POST',
    url: `/api/rooms/${code}/${action}`,
    headers: user?.headers,
  })
}

export function get(
  server: TestServer,
  url: string,
  user: TestUser | null = null
): Promise<LightMyRequestResponse> {
  return server.app.inject({ method: 'GET', url, headers: user?.headers })
}

/** Joins every user in sequence and fails the test unless each join answers 200. */
export async function joinAll(server: TestServer, code: string, users: TestUser[]): Promise<void> {
  for (const user of users) {
    const response = await roomAction(server, user, code, 'join')
    expect(response.statusCode, response.body).toBe(200)
  }
}

/** Durable Membership as stored in PostgreSQL, independent of any HTTP projection. */
export async function countMembers(server: TestServer, roomId: string): Promise<number> {
  const [row] = await server.app.db
    .select({ total: count() })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, roomId))
  return row?.total ?? 0
}

export async function findRoomRow(server: TestServer, roomId: string) {
  const [row] = await server.app.db.select().from(rooms).where(eq(rooms.id, roomId))
  return row ?? null
}

/** Moves `completedAt` into the past to simulate time passing after a room filled up. */
export async function backdateCompletion(
  server: TestServer,
  roomId: string,
  minutesAgo: number
): Promise<void> {
  await server.app.db
    .update(rooms)
    .set({ completedAt: sql`now() - make_interval(mins => ${minutesAgo})` })
    .where(eq(rooms.id, roomId))
}

export async function setRoomStatus(
  server: TestServer,
  roomId: string,
  status: 'waiting' | 'playing' | 'finished'
): Promise<void> {
  await server.app.db.update(rooms).set({ status }).where(eq(rooms.id, roomId))
}
