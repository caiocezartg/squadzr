import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '@/app'
import { connect, type RealtimeSession } from '@test/harness/realtime'
import { buildTestServer, createTestEnv, type TestServer } from '@test/harness/test-server'

// CCC-34: a client frame that breaks the realtime contract gets a typed error
// reply, and the server log describes it by code and issue location only. The
// frame and the JSON parser message, which quotes it, never reach the log.

const SECRET = 'PrivateSessionTokenXYZ'
const INVITE = 'https://discord.gg/review-secret'

type LogEntry = Record<string, unknown>

let database: TestServer
let server: TestServer
let lines: string[]
const sessions: RealtimeSession[] = []

/** The real app on an isolated database, with everything it logs at warn and above captured. */
async function buildLoggedServer(): Promise<TestServer> {
  database = await buildTestServer()
  await database.app.close()

  const app: FastifyInstance = await buildApp({
    env: createTestEnv({ DATABASE_URL: database.databaseUrl }),
    logger: { level: 'warn', stream: { write: (line: string) => lines.push(line) } },
  })
  await app.ready()
  return { app, databaseUrl: database.databaseUrl, close: () => app.close() }
}

function logs(): LogEntry[] {
  return lines.map((line) => JSON.parse(line) as LogEntry)
}

async function open(): Promise<RealtimeSession> {
  const session = await connect(server)
  sessions.push(session)
  return session
}

beforeEach(async () => {
  lines = []
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
    expect(logs()).toEqual([
      expect.objectContaining({
        msg: 'Invalid WebSocket message',
        code: 'PARSE_ERROR',
        issues: [{ path: '', code: 'invalid_json' }],
      }),
    ])
    expect(logs()[0]).not.toHaveProperty('err')
    expect(lines.join('\n')).not.toContain(SECRET)
    expect(lines.join('\n')).not.toContain(INVITE)
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
    expect(logs()).toEqual([
      expect.objectContaining({
        msg: 'Invalid WebSocket message',
        code: 'INVALID_MESSAGE',
        issues: [{ path: 'payload.roomCode', code: expect.any(String) }],
      }),
    ])
    expect(lines.join('\n')).not.toContain(SECRET)
    expect(lines.join('\n')).not.toContain(INVITE)
    expect(socket.client.readyState).toBe(socket.client.OPEN)
  })
})
