import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT, chatMessageSchema } from '@squadzr/schemas'
import { signInMany, type TestUser } from '@test/harness/auth'
import { createRoom, insertGame, joinAll, roomAction } from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  type RealtimeSession,
  type ServerMessage,
} from '@test/harness/realtime'
import { FakeClock } from '@test/harness/clock'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// Squad Chat delivery over the realtime channel: who receives a stored message, and who must not.

let server: TestServer
let clock: FakeClock
let host: TestUser
let member: TestUser
let outsider: TestUser
let code: string
const sessions: RealtimeSession[] = []

async function open(user: TestUser): Promise<RealtimeSession> {
  const session = await connect(server, user)
  sessions.push(session)
  return session
}

async function openInRoom(user: TestUser): Promise<RealtimeSession> {
  const session = await open(user)
  await joinRoomChannel(session, code)
  return session
}

function send(actor: TestUser, body: string, roomCode = code) {
  return server.app.inject({
    method: 'POST',
    url: `/api/rooms/${roomCode}/messages`,
    headers: actor.headers,
    payload: { id: randomUUID(), body },
  })
}

function typing(actor: RealtimeSession, roomCode = code): void {
  actor.send({ type: 'chat_typing', payload: { roomCode } })
}

function typingEvents(received: ServerMessage[]): ServerMessage[] {
  return received.filter((message) => message.type === 'chat_typing')
}

function chatMessages(received: ServerMessage[]): ServerMessage[] {
  return received.filter((message) => message.type === 'chat_message')
}

beforeEach(async () => {
  clock = new FakeClock(new Date())
  server = await buildTestServer({}, { clock })
  ;[host, member, outsider] = (await signInMany(server, 3)) as [TestUser, TestUser, TestUser]
  const game = await insertGame(server, 4)
  const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 4 })
  code = room.code
  await joinAll(server, code, [member])
})

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server?.close()
  vi.restoreAllMocks()
})

describe('chat_message delivery', () => {
  it('reaches every member socket, the author other tabs included, with the HTTP body', async () => {
    const hostTab = await openInRoom(host)
    const memberTab = await openInRoom(member)
    const memberOtherTab = await openInRoom(member)

    const response = await send(member, '  oi, time!  ')
    expect(response.statusCode, response.body).toBe(201)
    const stored = chatMessageSchema.parse(response.json())

    for (const tab of [hostTab, memberTab, memberOtherTab]) {
      const received = chatMessages(await tab.drain())
      expect(received).toHaveLength(1)
      expect(received[0]).toMatchObject({ type: 'chat_message', payload: { message: stored } })
    }
  })

  it('never reaches a lobby socket, a socket of another Squad or a guest', async () => {
    const otherGame = await insertGame(server, 4)
    const otherRoom = await createRoom(server, outsider, { gameId: otherGame.id, maxPlayers: 4 })
    const lobby = await open(outsider)
    await subscribeCatalog(lobby)
    const elsewhere = await open(outsider)
    await joinRoomChannel(elsewhere, otherRoom.code)
    const guest = await connect(server)
    sessions.push(guest)
    const memberTab = await openInRoom(member)

    await send(member, 'só para o time')

    expect(chatMessages(await memberTab.drain())).toHaveLength(1)
    for (const bystander of [lobby, elsewhere, guest])
      expect(chatMessages(await bystander.drain())).toEqual([])
  })

  it('does not deliver a retry of a stored send twice', async () => {
    const hostTab = await openInRoom(host)
    const id = randomUUID()
    const post = () =>
      server.app.inject({
        method: 'POST',
        url: `/api/rooms/${code}/messages`,
        headers: member.headers,
        payload: { id, body: 'uma vez só' },
      })

    expect((await post()).statusCode).toBe(201)
    expect((await post()).statusCode).toBe(200)

    expect(chatMessages(await hostTab.drain())).toHaveLength(1)
  })

  it('delivers nothing for a send that is refused', async () => {
    const hostTab = await openInRoom(host)
    await openInRoom(member)

    const refused = await send(outsider, 'não sou do time')

    expect(refused.statusCode).toBe(422)
    expect(chatMessages(await hostTab.drain())).toEqual([])
  })

  it('stops reaching a member who left over HTTP, even on a tab that is still open', async () => {
    const hostTab = await openInRoom(host)
    const leaverTab = await openInRoom(member)
    const gate = Promise.withResolvers<void>()
    const release = () => gate.resolve()
    const getSnapshot = server.app.realtime.getSnapshot
    const read = getSnapshot.execute.bind(getSnapshot)
    vi.spyOn(getSnapshot, 'execute').mockImplementation(async (input) => {
      await gate.promise
      return read(input)
    })
    const left = await roomAction(server, member, code, 'leave')
    expect(left.statusCode, left.body).toBe(200)

    // The revocation waits for its snapshot, so the chat frame is queued behind it on the
    // leaver's socket: the socket is still in the room channel when the message is broadcast.
    const response = await send(host, 'depois que saiu')
    expect(response.statusCode, response.body).toBe(201)
    release()

    const leaverFrames = await leaverTab.drain()
    expect(chatMessages(leaverFrames)).toEqual([])
    expect(leaverFrames.map((frame) => frame.type)).toContain('error')
    expect(chatMessages(await hostTab.drain())).toHaveLength(1)

    await send(host, 'e agora de vez')
    expect(chatMessages(await leaverTab.drain())).toEqual([])
  })

  it('stops reaching the other tabs of the member who left', async () => {
    const hostTab = await openInRoom(host)
    const firstTab = await openInRoom(member)
    const secondTab = await openInRoom(member)
    await roomAction(server, member, code, 'leave')

    await send(host, 'para quem ficou')

    expect(chatMessages(await firstTab.drain())).toEqual([])
    expect(chatMessages(await secondTab.drain())).toEqual([])
    expect(chatMessages(await hostTab.drain())).toHaveLength(1)
  })
})

describe('chat_typing delivery', () => {
  it('reaches the other members, never a socket of the typist, the other tab included', async () => {
    const hostTab = await openInRoom(host)
    const memberTab = await openInRoom(member)
    const memberOtherTab = await openInRoom(member)

    typing(memberTab)

    const received = typingEvents(await hostTab.drain())
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({
      type: 'chat_typing',
      payload: { roomCode: code, playerId: member.id },
    })
    expect(typingEvents(await memberTab.drain())).toEqual([])
    expect(typingEvents(await memberOtherTab.drain())).toEqual([])
  })

  it('never reaches a lobby socket, a socket of another Squad or a guest', async () => {
    const otherGame = await insertGame(server, 4)
    const otherRoom = await createRoom(server, outsider, { gameId: otherGame.id, maxPlayers: 4 })
    const lobby = await open(outsider)
    await subscribeCatalog(lobby)
    const elsewhere = await open(outsider)
    await joinRoomChannel(elsewhere, otherRoom.code)
    const guest = await connect(server)
    sessions.push(guest)
    const hostTab = await openInRoom(host)
    const memberTab = await openInRoom(member)

    typing(memberTab)

    expect(typingEvents(await hostTab.drain())).toHaveLength(1)
    for (const bystander of [lobby, elsewhere, guest])
      expect(typingEvents(await bystander.drain())).toEqual([])
  })

  it('drops typing from a socket that has not joined the Squad', async () => {
    const hostTab = await openInRoom(host)
    const notJoined = await open(member)

    typing(notJoined)

    expect(typingEvents(await hostTab.drain())).toEqual([])
    expect(typingEvents(await notJoined.drain())).toEqual([])
  })

  it('drops typing that names a Squad other than the one the socket joined', async () => {
    const otherGame = await insertGame(server, 4)
    const otherRoom = await createRoom(server, outsider, { gameId: otherGame.id, maxPlayers: 4 })
    const otherHostTab = await open(outsider)
    await joinRoomChannel(otherHostTab, otherRoom.code)
    const memberTab = await openInRoom(member)

    typing(memberTab, otherRoom.code)

    expect(typingEvents(await otherHostTab.drain())).toEqual([])
  })

  it('drops typing from a guest socket', async () => {
    const hostTab = await openInRoom(host)
    const guest = await connect(server)
    sessions.push(guest)

    typing(guest)

    expect(typingEvents(await hostTab.drain())).toEqual([])
  })

  it('forwards one frame per throttle for each socket and drops the extras silently', async () => {
    const hostTab = await openInRoom(host)
    const memberTab = await openInRoom(member)

    for (let i = 0; i < 6; i += 1) typing(memberTab)
    expect(typingEvents(await hostTab.drain())).toHaveLength(1)

    clock.advance(CHAT.TYPING_THROTTLE_MS - 1)
    typing(memberTab)
    expect(typingEvents(await hostTab.drain())).toEqual([])

    clock.advance(1)
    typing(memberTab)
    expect(typingEvents(await hostTab.drain())).toHaveLength(1)
  })

  it('does not count dropped frames as invalid, so the socket is never warned or closed', async () => {
    const hostTab = await openInRoom(host)
    const memberTab = await openInRoom(member)

    // Far more than the invalid-message limit, in batches under the socket's pending-operation limit
    // and inside its message rate.
    const frames: ServerMessage[] = []
    for (let batch = 0; batch < 5; batch += 1) {
      for (let i = 0; i < 6; i += 1) typing(memberTab)
      frames.push(...(await memberTab.drain()))
    }

    expect(frames.filter((frame) => frame.type === 'error')).toEqual([])
    expect(memberTab.server.readyState).toBe(memberTab.server.OPEN)
    expect(typingEvents(await hostTab.drain())).toHaveLength(1)
  })

  it('throttles each socket on its own', async () => {
    const hostTab = await openInRoom(host)
    const memberTab = await openInRoom(member)
    const memberOtherTab = await openInRoom(member)

    typing(memberTab)
    typing(memberOtherTab)

    expect(typingEvents(await hostTab.drain())).toHaveLength(2)
  })

  it('stops reaching a member who left over HTTP', async () => {
    const hostTab = await openInRoom(host)
    const leaverTab = await openInRoom(member)
    await roomAction(server, member, code, 'leave')
    await leaverTab.drain()

    typing(hostTab)

    expect(typingEvents(await leaverTab.drain())).toEqual([])
  })
})
