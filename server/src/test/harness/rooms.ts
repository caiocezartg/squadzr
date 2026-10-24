import { randomUUID } from 'node:crypto'
import { count, eq } from 'drizzle-orm'
import type { LightMyRequestResponse } from 'fastify'
import { expect } from 'vitest'
import { roomSchema, type GameDto, type GameSummaryDto, type RoomDto } from '@squadzr/schemas'
import { games, roomMembers, rooms } from '@infrastructure/database/schema'
import type { TestUser } from './auth'
import type { TestServer } from './test-server'

export const DISCORD_INVITE = 'https://discord.gg/squadzr'

export interface InsertGameOptions {
  name?: string
  slug?: string
  coverUrl?: string
  thumbnailUrl?: string
  genres?: GameDto['genres']
  popularity?: number
  listed?: boolean
  featuredRank?: number | null
  igdbId?: number | null
  minPlayers?: number
  maxPlayers?: number
}

export interface InsertedGame {
  /** The catalog contract (CCC-93 grows it; CCC-92 keeps it unchanged). */
  readonly game: GameDto
  /** The summary a Squad carries for this Game, as the API projects it. */
  readonly summary: GameSummaryDto
}

/**
 * Inserts a game with its catalog columns and exposes both the HTTP catalog
 * fixture and the Squad summary. A legacy Game is `listed: false` with no
 * `igdbId` and no genres.
 */
export async function insertGameFixture(
  server: TestServer,
  options: InsertGameOptions = {}
): Promise<InsertedGame> {
  const slug = options.slug ?? `game-${randomUUID().slice(0, 8)}`
  const coverUrl = options.coverUrl ?? `https://cdn.squadzr.test/${slug}.webp`
  const [game] = await server.app.db
    .insert(games)
    .values({
      name: options.name ?? `Game ${slug}`,
      slug,
      igdbId: options.igdbId ?? null,
      genres: options.genres ?? [],
      coverUrl,
      thumbnailUrl: options.thumbnailUrl ?? coverUrl,
      popularity: options.popularity ?? 0,
      // Catalog fixtures are listed by default; every flow that creates a
      // Squad needs a listed game to point at.
      listed: options.listed ?? true,
      featuredRank: options.featuredRank ?? null,
      minPlayers: options.minPlayers ?? 2,
      maxPlayers: options.maxPlayers ?? 5,
    })
    .returning()
  if (!game) throw new Error('Failed to insert game')
  // One summary, spread into both fixtures: `thumbnailUrl` is mapped to the
  // contract's `coverThumbUrl` exactly once.
  const summary: GameSummaryDto = {
    id: game.id,
    name: game.name,
    slug: game.slug,
    genres: game.genres,
    coverUrl: game.coverUrl,
    coverThumbUrl: game.thumbnailUrl,
  }
  return {
    game: {
      ...summary,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      createdAt: game.createdAt.toISOString(),
      updatedAt: game.updatedAt.toISOString(),
    },
    summary,
  }
}

export async function insertGame(
  server: TestServer,
  maxPlayersOrOptions: number | InsertGameOptions = 5
): Promise<GameDto> {
  const options =
    typeof maxPlayersOrOptions === 'number'
      ? { maxPlayers: maxPlayersOrOptions }
      : maxPlayersOrOptions
  return (await insertGameFixture(server, options)).game
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

/**
 * Writes the three lifecycle timestamps from explicit `Date` values, so tests
 * can place a room at exact instants (e.g. exactly `lastActivityAt + 24h`) as
 * Open (`readyAt: null`) or Ready. Honors the CHECK constraints by construction.
 */
export async function setRoomLifecycle(
  server: TestServer,
  roomId: string,
  lifecycle: { createdAt: Date; lastActivityAt: Date; readyAt: Date | null }
): Promise<void> {
  // Keep created_at at or before the activity/readiness anchors the caller
  // chose, so the CHECK constraints hold regardless of the combination.
  const createdAt = new Date(
    Math.min(
      lifecycle.createdAt.getTime(),
      lifecycle.lastActivityAt.getTime(),
      lifecycle.readyAt?.getTime() ?? Number.POSITIVE_INFINITY
    )
  )
  await server.app.db
    .update(rooms)
    .set({
      createdAt,
      lastActivityAt: lifecycle.lastActivityAt,
      readyAt: lifecycle.readyAt,
      updatedAt: lifecycle.lastActivityAt,
    })
    .where(eq(rooms.id, roomId))
}
