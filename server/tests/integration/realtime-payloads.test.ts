/**
 * Characterization of how `/ws` treats invalid input and oversized frames today.
 *
 * REPLACED BY CCC-37: the whole contract below (1 MiB `maxPayload`, `INVALID_MESSAGE` for
 * schema-invalid messages, `PARSE_ERROR` for malformed JSON, and no limit on repeated invalid
 * messages) is recorded as current behavior for the realtime module rewrite, not as a
 * requirement to preserve.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { signInMany } from '@test/harness/auth'
import { countMembers, createRoom, insertGame, joinAll } from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  subscriptionState,
  type RealtimeSession,
} from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

const MAX_PAYLOAD_BYTES = 1_048_576
const MESSAGE_TOO_BIG = 1009

const invalidMessage = {
  type: 'error',
  timestamp: expect.any(Number),
  payload: { code: 'INVALID_MESSAGE', message: 'Invalid message format' },
}
const parseError = {
  type: 'error',
  timestamp: expect.any(Number),
  payload: { code: 'PARSE_ERROR', message: 'Failed to parse message' },
}

let server: TestServer
const sessions: RealtimeSession[] = []

async function open(...args: Parameters<typeof connect>): Promise<RealtimeSession> {
  const session = await connect(...args)
  sessions.push(session)
  return session
}

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server?.close()
})

/** A JSON text frame of exactly `bytes` bytes that parses but fails the message schema. */
function paddedJsonFrame(bytes: number): string {
  const envelope = JSON.stringify({ type: 'ping', padding: '' })
  return envelope.replace('"padding":""', `"padding":"${'x'.repeat(bytes - envelope.length)}"`)
}

describe('invalid messages', () => {
  it.each([
    ['an unknown type', { type: 'game_start' }],
    ['a server-only type', { type: 'room_joined', payload: {} }],
    ['a missing payload', { type: 'join_room' }],
    ['a room code with the wrong length', { type: 'join_room', payload: { roomCode: 'ABC' } }],
    ['a JSON value that is not an object', 42],
  ])('answers %s with INVALID_MESSAGE and keeps the socket open', async (_case, message) => {
    server = await buildTestServer()
    const socket = await open(server)

    socket.send(message)

    expect(await socket.drain()).toEqual([invalidMessage])
    expect(socket.client.readyState).toBe(socket.client.OPEN)
  })

  it('answers malformed JSON with PARSE_ERROR and keeps the socket open', async () => {
    server = await buildTestServer()
    const socket = await open(server)

    socket.sendRaw('{"type":"ping"')

    expect(await socket.drain()).toEqual([parseError])
    expect(socket.client.readyState).toBe(socket.client.OPEN)
  })

  it('accepts JSON sent as a binary frame', async () => {
    server = await buildTestServer()
    const socket = await open(server)

    socket.sendRaw(Buffer.from(JSON.stringify({ type: 'ping' })))

    expect((await socket.next()).type).toBe('pong')
  })

  it('answers every repeated invalid message without throttling or closing', async () => {
    server = await buildTestServer()
    const socket = await open(server)
    const attempts = 200

    for (let i = 0; i < attempts; i++) {
      socket.sendRaw(i % 2 === 0 ? 'not json' : JSON.stringify({ type: 'nope' }))
    }

    expect(await socket.drain()).toEqual(
      Array.from({ length: attempts }, (_, i) => (i % 2 === 0 ? parseError : invalidMessage))
    )
    expect(socket.client.readyState).toBe(socket.client.OPEN)
  })
})

describe('1 MiB maxPayload', () => {
  it('processes a frame of exactly 1 MiB', async () => {
    server = await buildTestServer()
    const socket = await open(server)
    const frame = paddedJsonFrame(MAX_PAYLOAD_BYTES)

    expect(Buffer.byteLength(frame)).toBe(MAX_PAYLOAD_BYTES)
    socket.sendRaw(frame)

    // The extra `padding` key is stripped by the schema, so this is a valid ping.
    expect((await socket.next()).type).toBe('pong')
  })

  it('closes the connection with 1009 on a frame one byte over the limit, without an error message', async () => {
    server = await buildTestServer()
    const socket = await open(server)
    const received: unknown[] = []
    socket.client.on('message', (raw: Buffer) => received.push(raw.toString()))

    socket.sendRaw(paddedJsonFrame(MAX_PAYLOAD_BYTES + 1))

    expect((await socket.clientClosed).code).toBe(MESSAGE_TOO_BIG)
    await socket.serverClosed
    expect(received).toEqual([])
    expect(server.app.websocketServer.clients.size).toBe(0)
  })

  it('cleans catalog and room subscriptions after an oversized-frame close, keeping Membership', async () => {
    server = await buildTestServer()
    const [host, member] = await signInMany(server, 2)
    const game = await insertGame(server)
    const room = await createRoom(server, host!, { gameId: game.id })
    await joinAll(server, room.code, [member!])
    const hostSocket = await open(server, host!)
    await joinRoomChannel(hostSocket, room.code)
    const offender = await open(server, member!)
    await subscribeCatalog(offender)
    await joinRoomChannel(offender, room.code)
    expect((await hostSocket.next()).type).toBe('player_joined')

    offender.sendRaw(paddedJsonFrame(MAX_PAYLOAD_BYTES + 1))
    await offender.serverClosed

    const state = subscriptionState(server)
    expect(state.catalogSubscribers()).toBe(0)
    expect(state.roomSockets(room.code)).toBe(1)
    expect(await countMembers(server, room.id)).toBe(2)

    // REPLACED BY CCC-37: the oversized frame triggers both the `error` and the `close`
    // listeners, and disconnect is not idempotent, so the room hears viewer_left twice.
    const viewerLeft = {
      type: 'viewer_left',
      timestamp: expect.any(Number),
      payload: { playerId: member!.id, roomCode: room.code },
    }
    expect(await hostSocket.drain()).toEqual([viewerLeft, viewerLeft])
  })
})
