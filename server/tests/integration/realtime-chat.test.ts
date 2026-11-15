/**
 * The Squad chat preview: members write through the Squad's channel, everyone in the channel receives the
 * message, and a member who joins later receives the latest messages after the snapshot.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { CHAT_MESSAGE_MAX_LENGTH } from '@squadzr/schemas/ws'
import { signIn, signInMany } from '@test/harness/auth'
import { createRoom, insertGame, joinAll } from '@test/harness/rooms'
import { connect, joinRoomChannel, type RealtimeSession } from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

let server: TestServer
const sessions: RealtimeSession[] = []

async function open(...args: Parameters<typeof connect>): Promise<RealtimeSession> {
  const session = await connect(...args)
  sessions.push(session)
  return session
}

/** A Squad with its host and one member, both in its channel. */
async function squadWithTwoMembers() {
  server = await buildTestServer()
  const [host, member] = await signInMany(server, 2)
  const game = await insertGame(server)
  const room = await createRoom(server, host!, { gameId: game.id })
  await joinAll(server, room.code, [member!])
  const hostSocket = await open(server, host!)
  await joinRoomChannel(hostSocket, room.code)
  const memberSocket = await open(server, member!)
  await joinRoomChannel(memberSocket, room.code)
  await hostSocket.drain()
  return { room, host: host!, member: member!, hostSocket, memberSocket }
}

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server?.close()
})

describe('squad chat', () => {
  it('sends a member message, trimmed, to everyone in the channel, the author included', async () => {
    const { room, member, hostSocket, memberSocket } = await squadWithTwoMembers()

    memberSocket.send({ type: 'chat_send', payload: { roomCode: room.code, body: '  bora?  ' } })

    const expected = {
      type: 'chat_message',
      timestamp: expect.any(Number),
      payload: {
        roomCode: room.code,
        message: {
          id: expect.any(String),
          authorId: member.id,
          authorName: member.name,
          authorImage: member.image,
          body: 'bora?',
          sentAt: expect.any(String),
        },
      },
    }
    expect(await memberSocket.drain()).toEqual([expected])
    expect(await hostSocket.drain()).toEqual([expected])
  })

  it('sends the latest messages, oldest first, after the snapshot of a later join', async () => {
    const { room, host, memberSocket } = await squadWithTwoMembers()
    memberSocket.send({ type: 'chat_send', payload: { roomCode: room.code, body: 'first' } })
    memberSocket.send({ type: 'chat_send', payload: { roomCode: room.code, body: 'second' } })
    await memberSocket.drain()

    const secondTab = await open(server, host)
    await joinRoomChannel(secondTab, room.code)

    const [history] = await secondTab.drain()
    expect(history).toMatchObject({
      type: 'chat_history',
      payload: { roomCode: room.code, messages: [{ body: 'first' }, { body: 'second' }] },
    })
  })

  it('sends no history when the chat is empty', async () => {
    const { room, host } = await squadWithTwoMembers()

    const secondTab = await open(server, host)
    await joinRoomChannel(secondTab, room.code)

    expect(await secondTab.drain()).toEqual([])
  })

  it('ignores a message for a Squad whose channel the socket has not joined', async () => {
    const { room, hostSocket, memberSocket } = await squadWithTwoMembers()
    const outsider = await open(server, await signIn(server, 'Outsider'))

    outsider.send({ type: 'chat_send', payload: { roomCode: room.code, body: 'hello' } })

    expect(await outsider.drain()).toEqual([])
    expect(await hostSocket.drain()).toEqual([])
    expect(await memberSocket.drain()).toEqual([])
  })

  it('refuses a guest', async () => {
    const { room } = await squadWithTwoMembers()
    const guest = await open(server)

    guest.send({ type: 'chat_send', payload: { roomCode: room.code, body: 'hello' } })

    expect((await guest.next()).payload).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    })
  })

  it.each([
    ['blank', '   '],
    ['too long', 'a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1)],
  ])('refuses a %s message as invalid, and sends it to nobody', async (_, body) => {
    const { room, hostSocket, memberSocket } = await squadWithTwoMembers()

    memberSocket.send({ type: 'chat_send', payload: { roomCode: room.code, body } })

    expect((await memberSocket.next()).payload).toMatchObject({ code: 'INVALID_MESSAGE' })
    expect(await hostSocket.drain()).toEqual([])
  })
})
