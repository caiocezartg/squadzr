import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { wsServerMessageSchema } from '@squadzr/schemas/ws'
import { signIn, type TestUser } from '@test/harness/auth'
import { createRoom, insertGame, joinAll } from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  type RealtimeSession,
} from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #119: after an Admin Closure commits, the lobby hears `room_deleted`, the board `room_removed` and
// every member, host included, gets its notification live with the reason.

let server: TestServer
let moderator: TestUser
let gameId: string
const sessions: RealtimeSession[] = []

beforeEach(async () => {
  server = await buildTestServer()
  moderator = await signIn(server, 'Mo Moderator', { role: 'moderator' })
  gameId = (await insertGame(server)).id
})

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server.close()
})

async function open(user: TestUser | null = null): Promise<RealtimeSession> {
  const session = await connect(server, user)
  sessions.push(session)
  return session
}

async function pushesOf(socket: RealtimeSession) {
  const messages = await socket.drain()
  return {
    types: messages.map((message) => message.type),
    notifications: messages
      .filter((message) => message.type === 'notification')
      .map((message) => wsServerMessageSchema.parse(message)),
  }
}

describe('closing a Squad as an admin', () => {
  it('tells the lobby, the board and each member live', async () => {
    const [host, member, bystander] = await Promise.all(
      ['Host', 'Member', 'Bystander'].map((name) => signIn(server, name))
    )
    const room = await createRoom(server, host!, { gameId, maxPlayers: 5 })
    await joinAll(server, room.code, [member!])
    const hostSocket = await open(host!)
    const memberSocket = await open(member!)
    const bystanderSocket = await open(bystander!)
    const board = await open()
    await joinRoomChannel(hostSocket, room.code)
    await joinRoomChannel(memberSocket, room.code)
    await subscribeCatalog(board)
    await Promise.all([hostSocket, memberSocket, bystanderSocket, board].map((s) => s.drain()))

    const response = await server.app.inject({
      method: 'POST',
      url: `/api/admin/squads/${room.id}/close`,
      headers: moderator.headers,
      payload: { reason: 'Offensive squad name' },
    })
    expect(response.statusCode, response.body).toBe(204)

    for (const socket of [hostSocket, memberSocket]) {
      const { types, notifications } = await pushesOf(socket)
      expect(types).toContain('room_deleted')
      expect(notifications).toHaveLength(1)
      expect(notifications[0]).toMatchObject({
        payload: {
          notification: {
            type: 'room_closed_by_admin',
            payload: { roomId: room.id, roomCode: room.code, reason: 'Offensive squad name' },
          },
        },
      })
      expect(JSON.stringify(notifications)).not.toContain(moderator.id)
    }
    expect((await pushesOf(bystanderSocket)).notifications).toEqual([])
    expect(await board.drain()).toContainEqual(
      expect.objectContaining({
        type: 'room_removed',
        payload: expect.objectContaining({ roomCode: room.code }),
      })
    )
  })
})
