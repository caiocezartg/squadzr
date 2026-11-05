import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { roomSnapshotMessageSchema, wsServerMessageSchema } from '@squadzr/schemas/ws'
import { signIn, type TestUser } from '@test/harness/auth'
import { DISCORD_INVITE, createRoom, insertGame, roomAction } from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  type RealtimeSession,
  type ServerMessage,
} from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'
import type { RoomDto } from '@squadzr/schemas'

// #112: after the commit of a Squad Release, the members of each affected Squad get the new
// snapshot, the people who left lose the channel, the board hears about every Squad and each
// notification is pushed, with the invite only on `room_ready`.

let server: TestServer
let gameId: string
const sessions: RealtimeSession[] = []

beforeEach(async () => {
  server = await buildTestServer()
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

async function people(...names: string[]): Promise<TestUser[]> {
  return Promise.all(names.map((name) => signIn(server, name)))
}

async function squad(host: TestUser, maxPlayers: number): Promise<RoomDto> {
  return createRoom(server, host, { gameId, maxPlayers })
}

async function join(user: TestUser, room: RoomDto): Promise<void> {
  const response = await roomAction(server, user, room.code, 'join')
  expect(response.statusCode, response.body).toBe(200)
}

const typesOf = (messages: ServerMessage[]) => messages.map((message) => message.type)

describe('after a Squad Release commits', () => {
  it('sends the new snapshot to the Squad that kept going, revokes the leaver and tells the board', async () => {
    const [hostA, owner, heir, other] = await people('Host A', 'Owner', 'Heir', 'Other')
    const a = await squad(hostA!, 2)
    const b = await squad(owner!, 4)
    await join(heir!, b)
    await join(other!, b)
    const heirSocket = await open(heir!)
    const ownerSocket = await open(owner!)
    const board = await open()
    await joinRoomChannel(heirSocket, b.code)
    await joinRoomChannel(ownerSocket, b.code)
    await subscribeCatalog(board)

    await join(owner!, a)

    const heirMessages = await heirSocket.drain()
    const snapshot = roomSnapshotMessageSchema.parse(
      heirMessages.find((message) => message.type === 'room_snapshot')
    )
    expect(snapshot.payload.room.id).toBe(b.id)
    expect(snapshot.payload.players.map((player) => player.id).sort()).toEqual(
      [heir!.id, other!.id].sort()
    )
    expect(snapshot.payload.players.filter((player) => player.isHost).map((p) => p.id)).toEqual([
      heir!.id,
    ])

    const ownerMessages = await ownerSocket.drain()
    expect(ownerMessages.filter((message) => message.type === 'room_snapshot')).toEqual([])
    expect(ownerMessages).toContainEqual(
      expect.objectContaining({
        type: 'error',
        payload: expect.objectContaining({ code: 'NOT_ROOM_MEMBER' }),
      })
    )

    const boardMessages = await board.drain()
    expect(boardMessages).toContainEqual(
      expect.objectContaining({
        type: 'room_updated',
        payload: expect.objectContaining({ roomCode: b.code, memberCount: 2 }),
      })
    )
    expect(boardMessages).toContainEqual(
      expect.objectContaining({
        type: 'room_removed',
        payload: expect.objectContaining({ roomCode: a.code }),
      })
    )
  })

  it('announces a closed or emptied Squad as deleted to its members and as removed to the board', async () => {
    const [hostA, owner, busy] = await people('Host A', 'Owner', 'Busy')
    const a = await squad(hostA!, 2)
    const b = await squad(owner!, 3)
    await join(busy!, b)
    await squad(busy!, 3)
    const busySocket = await open(busy!)
    const board = await open()
    await joinRoomChannel(busySocket, b.code)
    await subscribeCatalog(board)

    await join(owner!, a)

    expect(typesOf(await busySocket.drain())).toContain('room_deleted')
    const boardMessages = await board.drain()
    expect(boardMessages).toContainEqual(
      expect.objectContaining({
        type: 'room_removed',
        payload: expect.objectContaining({ roomCode: b.code }),
      })
    )
  })

  it('pushes every notification to its owner, with the invite only on room_ready', async () => {
    const [hostA, owner, heir] = await people('Host A', 'Owner', 'Heir')
    const a = await squad(hostA!, 2)
    const b = await squad(owner!, 3)
    await join(heir!, b)
    const heirSocket = await open(heir!)
    const ownerSocket = await open(owner!)

    await join(owner!, a)

    const pushed = async (session: RealtimeSession) =>
      (await session.drain())
        .filter((message) => message.type === 'notification')
        .map((message) => wsServerMessageSchema.parse(message))
    const heirPushes = await pushed(heirSocket)
    const ownerPushes = await pushed(ownerSocket)

    expect(heirPushes).toHaveLength(1)
    expect(heirPushes[0]).toMatchObject({
      payload: { notification: { type: 'host_transferred', userId: heir!.id } },
    })
    expect(JSON.stringify(heirPushes)).not.toContain(DISCORD_INVITE)
    expect(ownerPushes).toHaveLength(1)
    expect(ownerPushes[0]).toMatchObject({
      payload: {
        notification: {
          type: 'room_ready',
          payload: { discordLink: DISCORD_INVITE, leftSquads: [{ roomCode: b.code }] },
        },
      },
    })
  })
})
