/**
 * CCC-37 intentionally replaces the CCC-33 framing characterization: 16 KiB
 * maxPayload, typed validation errors, and close 1008 for three invalid frames
 * within 60 seconds. The exact size boundary and one byte above remain tested.
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
import { FakeClock } from '@test/harness/clock'

const MAX_PAYLOAD_BYTES = 16_384
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

/**
 * A JSON text frame of exactly `bytes` bytes: a valid `ping` padded with an extra `padding`
 * field, used only to cross the payload size limit.
 */
function paddedJsonFrame(bytes: number): string {
  const envelope = JSON.stringify({ type: 'ping', padding: '' })
  return envelope.replace('"padding":""', `"padding":"${'x'.repeat(bytes - envelope.length)}"`)
}

describe('invalid messages', () => {
  it.each([
    ['an unknown type', { type: 'game_start' }],
    ['a retired server type', { type: 'room_joined', payload: {} }],
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

  it('answers three repeated malformed frames with typed errors then closes with 1008', async () => {
    server = await buildTestServer()
    const socket = await open(server)
    const attempts = 3

    for (let i = 0; i < attempts; i++) {
      socket.sendRaw(i % 2 === 0 ? 'not json' : JSON.stringify({ type: 'nope' }))
    }

    const replies = []
    for (let i = 0; i < attempts; i++) replies.push(await socket.next())
    expect(replies).toEqual([parseError, invalidMessage, parseError])
    expect((await socket.clientClosed).code).toBe(1008)
    await socket.serverClosed
    expect(socket.client.readyState).toBe(socket.client.CLOSED)
  })

  it('forgets invalid messages older than 60 seconds without letting valid pings reset the window', async () => {
    const clock = new FakeClock(new Date())
    server = await buildTestServer({}, { clock })
    const socket = await open(server)
    socket.sendRaw('not json')
    expect(await socket.drain()).toEqual([parseError])
    clock.advance(60_001)
    socket.send({ type: 'nope' })
    expect(await socket.drain()).toEqual([invalidMessage])
    socket.sendRaw('not json')
    expect(await socket.drain()).toEqual([parseError])
    expect(socket.client.readyState).toBe(socket.client.OPEN)
    socket.send({ type: 'nope' })
    expect(await socket.next()).toEqual(invalidMessage)
    expect((await socket.clientClosed).code).toBe(1008)
    await socket.serverClosed
  })
})

describe('16 KiB maxPayload', () => {
  it('processes a frame of exactly 16 KiB', async () => {
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
    const clock = new FakeClock(new Date())
    server = await buildTestServer({}, { clock })
    const [host, member] = await signInMany(server, 2)
    const game = await insertGame(server)
    const room = await createRoom(server, host!, { gameId: game.id })
    await joinAll(server, room.code, [member!])
    const hostSocket = await open(server, host!)
    await joinRoomChannel(hostSocket, room.code)
    const offender = await open(server, member!)
    await subscribeCatalog(offender)
    await joinRoomChannel(offender, room.code)
    expect((await hostSocket.next()).type).toBe('presence_updated')

    offender.sendRaw(paddedJsonFrame(MAX_PAYLOAD_BYTES + 1))
    await offender.serverClosed

    const state = subscriptionState(server)
    expect(state.catalogSubscribers()).toBe(0)
    expect(state.roomSockets(room.code)).toBe(1)
    expect(await countMembers(server, room.id)).toBe(2)

    expect(await hostSocket.drain()).toEqual([])
    clock.advance(10_000)
    await subscriptionState(server).sweepPresence()
    // The error and close listeners schedule one member transition after grace.
    expect(await hostSocket.drain()).toEqual([
      {
        type: 'presence_updated',
        timestamp: expect.any(Number),
        payload: { playerId: member!.id, roomCode: room.code, online: false },
      },
    ])
  })
})
