import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { buildApp } from '@/app'
import { DeleteExpiredRoomsUseCase } from '@application/use-cases/room/delete-expired-rooms.use-case'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { runRoomCleanup } from '@infrastructure/plugins/room-cleanup.plugin'
import { signIn } from '@test/harness/auth'
import {
  DISCORD_INVITE,
  createRoom,
  insertGame,
  joinAll,
  markRoomActivity,
  roomAction,
} from '@test/harness/rooms'
import { connect, type RealtimeSession } from '@test/harness/realtime'
import { createLogCapture, type LogCapture } from '@test/harness/logging'
import { buildTestServer, createTestEnv, type TestServer } from '@test/harness/test-server'

// CCC-34: a client frame that breaks the realtime contract gets a typed error
// reply, and the server log describes it by code and issue location only. The
// frame and the JSON parser message, which quotes it, never reach the log.
// CCC-36: the lifecycle transitions, scheduler failures and rolled-back joins
// are logged with identifiers only, never with the Discord invite.

const SECRET = 'PrivateSessionTokenXYZ'
const INVITE = 'https://discord.gg/review-secret'

type LogEntry = Record<string, unknown>

let database: TestServer
let server: TestServer
let capture: LogCapture
const sessions: RealtimeSession[] = []

/** The real app on an isolated database, with everything it logs at info and above captured. */
async function buildLoggedServer(): Promise<TestServer> {
  database = await buildTestServer()
  await database.app.close()

  capture = createLogCapture('info')
  const app: FastifyInstance = await buildApp({
    env: createTestEnv({ DATABASE_URL: database.databaseUrl }),
    logger: capture.logger,
  })
  await app.ready()
  return { app, databaseUrl: database.databaseUrl, close: () => app.close() }
}

function logs(): LogEntry[] {
  return capture.lines.map((line) => JSON.parse(line) as LogEntry)
}

function lifecycleLogs(): LogEntry[] {
  return logs().filter((entry) => String(entry.msg ?? '').startsWith('Room '))
}

/** Warn and above: the only channel allowed to carry an unexpected diagnostic. */
function warnAndAbove(): LogEntry[] {
  return logs().filter((entry) => Number(entry.level) >= 40)
}

async function open(): Promise<RealtimeSession> {
  const session = await connect(server)
  sessions.push(session)
  return session
}

beforeEach(async () => {
  server = await buildLoggedServer()
})

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server.close()
  await database.close()
})

describe('invalid WebSocket frames', () => {
  it.each([
    ['a bare identifier', SECRET],
    ['truncated JSON', `{"type":"join_room","payload":{"discordLink":"${INVITE}","t":"${SECRET}`],
  ])('answers %s with PARSE_ERROR and logs no part of the frame', async (_label, frame) => {
    const socket = await open()

    socket.sendRaw(Buffer.from(frame))

    expect(await socket.drain()).toEqual([
      {
        type: 'error',
        timestamp: expect.any(Number),
        payload: { code: 'PARSE_ERROR', message: 'Failed to parse message' },
      },
    ])
    const invalidFrameLogs = warnAndAbove()
    expect(invalidFrameLogs).toEqual([
      expect.objectContaining({
        msg: 'Invalid WebSocket message',
        code: 'PARSE_ERROR',
        issues: [{ path: '', code: 'invalid_json' }],
      }),
    ])
    expect(invalidFrameLogs[0]).not.toHaveProperty('err')
    expect(capture.lines.join('\n')).not.toContain(SECRET)
    expect(capture.lines.join('\n')).not.toContain(INVITE)
  })

  it('answers a frame that breaks the contract with INVALID_MESSAGE and logs issue paths and codes', async () => {
    const socket = await open()

    socket.send({ type: 'join_room', payload: { roomCode: SECRET, discordLink: INVITE } })

    expect(await socket.drain()).toEqual([
      {
        type: 'error',
        timestamp: expect.any(Number),
        payload: { code: 'INVALID_MESSAGE', message: 'Invalid message format' },
      },
    ])
    const invalidFrameLogs = warnAndAbove()
    expect(invalidFrameLogs).toEqual([
      expect.objectContaining({
        msg: 'Invalid WebSocket message',
        code: 'INVALID_MESSAGE',
        issues: [{ path: 'payload.roomCode', code: expect.any(String) }],
      }),
    ])
    expect(capture.lines.join('\n')).not.toContain(SECRET)
    expect(capture.lines.join('\n')).not.toContain(INVITE)
    expect(socket.client.readyState).toBe(socket.client.OPEN)
  })
})

describe('lifecycle logs', () => {
  it('records created, joined, ready, left and deleted without the invite', async () => {
    const host = await signIn(server, 'Host')
    const member = await signIn(server, 'Member')
    const game = await insertGame(server)

    const openRoom = await createRoom(server, host, { gameId: game.id, maxPlayers: 3 })
    await joinAll(server, openRoom.code, [member])
    await roomAction(server, member, openRoom.code, 'leave')

    const readyRoom = await createRoom(server, host, { gameId: game.id, maxPlayers: 2 })
    await joinAll(server, readyRoom.code, [member])

    const hostRoom = await createRoom(server, host, { gameId: game.id, maxPlayers: 3 })
    await roomAction(server, host, hostRoom.code, 'leave')

    const messages = lifecycleLogs().map((entry) => entry.msg)
    expect(messages).toEqual(
      expect.arrayContaining([
        'Room created',
        'Room joined',
        'Room left',
        'Room ready',
        'Room deleted (host left)',
      ])
    )
    expect(capture.lines.join('\n')).not.toContain(DISCORD_INVITE)
  })

  it('records expired and deleted rooms when the scheduler runs', async () => {
    const host = await signIn(server, 'Host')
    const game = await insertGame(server)
    const room = await createRoom(server, host, { gameId: game.id })
    await markRoomActivity(server, room.id, 25 * 60)

    const repository = new DrizzleRoomRepository(server.app.db, server.app.clock)
    const useCase = new DeleteExpiredRoomsUseCase(repository, server.app.clock)
    await runRoomCleanup(server.app.log, useCase, server.app.broadcaster)

    const messages = lifecycleLogs().map((entry) => entry.msg)
    expect(messages).toEqual(expect.arrayContaining(['Room expired', 'Room deleted']))
    expect(lifecycleLogs().find((entry) => entry.msg === 'Room expired')).toMatchObject({
      roomId: room.id,
      roomCode: room.code,
      reason: 'open_expired',
    })
    expect(capture.lines.join('\n')).not.toContain(DISCORD_INVITE)
  })

  it('records a scheduler failure without bringing the server down', async () => {
    const failingUseCase = {
      execute: async () => {
        throw new Error('scheduler database down')
      },
    }

    await expect(
      runRoomCleanup(server.app.log, failingUseCase, server.app.broadcaster)
    ).resolves.toBeUndefined()

    expect(logs()).toEqual(
      expect.arrayContaining([expect.objectContaining({ msg: 'Room cleanup failed' })])
    )
    expect((await server.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
  })

  it('records a rolled-back readiness transaction without the invite', async () => {
    const host = await signIn(server, 'Host')
    const member = await signIn(server, 'Member')
    const game = await insertGame(server)
    const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 2 })

    await server.app.db.execute(sql`
      CREATE OR REPLACE FUNCTION fail_room_ready_notification() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'notification persistence failed'; END;
      $$ LANGUAGE plpgsql
    `)
    await server.app.db.execute(sql`
      CREATE TRIGGER fail_room_ready_notification
      BEFORE INSERT ON user_notifications
      FOR EACH ROW EXECUTE FUNCTION fail_room_ready_notification()
    `)

    const failed = await roomAction(server, member, room.code, 'join')
    expect(failed.statusCode).toBe(500)

    expect(logs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          msg: 'Room join failed — activity, readiness and notifications rolled back',
          roomCode: room.code,
        }),
      ])
    )
    expect(capture.lines.join('\n')).not.toContain(DISCORD_INVITE)
  })
})
