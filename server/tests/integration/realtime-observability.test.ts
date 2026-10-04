import { afterEach, expect, it, vi } from 'vitest'
import { buildApp } from '@/app'
import { signInMany } from '@test/harness/auth'
import { FakeClock } from '@test/harness/clock'
import { createLogCapture } from '@test/harness/logging'
import { DISCORD_INVITE, createRoom, insertGame, joinAll } from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscriptionState,
  type RealtimeSession,
} from '@test/harness/realtime'
import { buildTestServer, createTestEnv, type TestServer } from '@test/harness/test-server'

let database: TestServer
let server: TestServer
const sessions: RealtimeSession[] = []

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server?.close()
  await database?.close()
  vi.useRealTimers()
})

it('logs counts, Membership, Presence, invalid messages and heartbeat timeouts without private data', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  database = await buildTestServer()
  await database.app.close()
  const clock = new FakeClock(new Date())
  const capture = createLogCapture()
  const app = await buildApp({
    env: createTestEnv({ DATABASE_URL: database.databaseUrl }),
    logger: capture.logger,
    clock,
  })
  await app.ready()
  server = { app, databaseUrl: database.databaseUrl, close: () => app.close() }
  const [host, member] = await signInMany(server, 2)
  const game = await insertGame(server)
  const room = await createRoom(server, host!, { gameId: game.id })
  const observer = await connect(server, host!)
  sessions.push(observer)
  await joinRoomChannel(observer, room.code)
  await joinAll(server, room.code, [member!])
  expect((await observer.next()).type).toBe('room_snapshot')
  const tab = await connect(server, member!)
  sessions.push(tab)
  await joinRoomChannel(tab, room.code)
  expect((await observer.next()).type).toBe('presence_updated')
  const secret = 'PrivateSessionDataDoNotLog'
  tab.sendRaw(`{"secret":"${secret}","invite":"${DISCORD_INVITE}"`)
  expect((await tab.next()).type).toBe('error')
  vi.spyOn(tab.client, 'pong').mockImplementation(() => {})
  clock.advance(20_000)
  await vi.advanceTimersByTimeAsync(1_000)
  await observer.drain()
  clock.advance(20_000)
  await vi.advanceTimersByTimeAsync(1_000)
  await tab.serverClosed
  clock.advance(10_000)
  await subscriptionState(server).sweepPresence()
  const logs = capture.lines.map((line) => JSON.parse(line) as Record<string, unknown>)
  expect(logs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ category: 'transport', event: 'connected', connectionCount: 2 }),
      expect.objectContaining({ category: 'transport', event: 'disconnected', connectionCount: 1 }),
      expect.objectContaining({
        category: 'transport',
        event: 'invalid_message',
        code: 'PARSE_ERROR',
        invalidCount: 1,
      }),
      expect.objectContaining({ category: 'transport', event: 'heartbeat_timeout' }),
      expect.objectContaining({ category: 'membership', event: 'snapshot', memberCount: 2 }),
      expect.objectContaining({
        category: 'presence',
        event: 'transition',
        userId: member!.id,
        online: true,
      }),
      expect.objectContaining({
        category: 'presence',
        event: 'transition',
        userId: member!.id,
        online: false,
      }),
    ])
  )
  const output = capture.lines.join('\n')
  for (const privateValue of [
    secret,
    DISCORD_INVITE,
    host!.name,
    member!.name,
    host!.headers.cookie,
    member!.headers.cookie,
  ]) {
    expect(output).not.toContain(privateValue)
  }
  for (const log of logs.filter((log) => log.category === 'transport')) {
    expect(log).not.toHaveProperty('session')
    expect(log).not.toHaveProperty('sessionUser')
    expect(log).not.toHaveProperty('hasSession')
  }
})
