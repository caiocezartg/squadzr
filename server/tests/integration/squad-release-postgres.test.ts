import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { userNotificationSchema, type UserNotificationDto } from '@squadzr/schemas'
import { ROOM } from '@config/constants'
import { roomMembers, userNotifications } from '@infrastructure/database/schema'
import { signIn, type TestUser } from '@test/harness/auth'
import { FakeClock } from '@test/harness/clock'
import { roomReadyPayload } from '@test/harness/notifications'
import {
  DISCORD_INVITE,
  createRoom,
  findRoomRow,
  get,
  insertGame,
  roomAction,
  setRoomLifecycle,
} from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'
import type { RoomDto } from '@squadzr/schemas'

// #112: the join that makes a Squad Ready takes every member out of their other valid Open
// Squads in the same transaction, and each Squad they leave hands its host over, closes or
// is deleted. Everything below goes through the HTTP API and reads the stored rows.

let server: TestServer
let clock: FakeClock
let gameId: string

beforeEach(async () => {
  clock = new FakeClock(new Date())
  server = await buildTestServer({}, { clock })
  gameId = (await insertGame(server)).id
})

afterEach(async () => {
  await server.close()
})

/** Every step moves the clock, so Memberships have distinct, increasing `joinedAt`. */
function tick(): void {
  clock.advance(1_000)
}

async function squad(host: TestUser, maxPlayers: number, name?: string): Promise<RoomDto> {
  tick()
  return createRoom(server, host, { gameId, maxPlayers, ...(name ? { name } : {}) })
}

async function join(user: TestUser, room: RoomDto): Promise<void> {
  tick()
  const response = await roomAction(server, user, room.code, 'join')
  expect(response.statusCode, response.body).toBe(200)
}

async function people(...names: string[]): Promise<TestUser[]> {
  return Promise.all(names.map((name) => signIn(server, name)))
}

async function notificationsOf(user: TestUser): Promise<UserNotificationDto[]> {
  const response = await get(server, '/api/notifications', user)
  expect(response.statusCode, response.body).toBe(200)
  return response
    .json<{ notifications: unknown[] }>()
    .notifications.map((notification) => userNotificationSchema.parse(notification))
}

async function memberIds(room: RoomDto): Promise<string[]> {
  const rows = await server.app.db
    .select({ userId: roomMembers.userId })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, room.id))
  return rows.map((row) => row.userId).sort()
}

const sorted = (...users: TestUser[]) => users.map((user) => user.id).sort()

describe('the Squad Release hands the host over', () => {
  it('gives the Squad to the oldest remaining member and tells the new host, the leaver and the Squad that filled', async () => {
    const [hostA, owner, oldest, youngest] = await people('Host A', 'Owner', 'Oldest', 'Youngest')
    const a = await squad(hostA!, 2, 'Squad A')
    const b = await squad(owner!, 4, 'Squad B')
    await join(oldest!, b)
    await join(youngest!, b)

    await join(owner!, a)

    expect((await findRoomRow(server, a.id))?.readyAt).not.toBeNull()
    expect(await memberIds(b)).toEqual(sorted(oldest!, youngest!))
    const row = await findRoomRow(server, b.id)
    expect(row?.hostId).toBe(oldest!.id)
    expect(row?.discordLink).toBe(DISCORD_INVITE)
    expect(row?.lastActivityAt).toEqual(clock.now())
    expect(row?.updatedAt).toEqual(clock.now())

    const ownerNotifications = await notificationsOf(owner!)
    expect(ownerNotifications.map((n) => n.type)).toEqual(['room_ready'])
    expect(roomReadyPayload(ownerNotifications[0]).leftSquads).toEqual([
      { roomCode: b.code, roomName: 'Squad B' },
    ])
    const hostNotifications = await notificationsOf(hostA!)
    expect(hostNotifications.map((n) => n.type)).toEqual(['room_ready'])
    expect(roomReadyPayload(hostNotifications[0])).not.toHaveProperty('leftSquads')

    const inherited = await notificationsOf(oldest!)
    expect(inherited).toHaveLength(1)
    expect(inherited[0]).toMatchObject({
      type: 'host_transferred',
      payload: {
        roomId: b.id,
        roomCode: b.code,
        roomName: 'Squad B',
        previousHost: { name: 'Owner' },
        reason: 'squad_completed',
      },
    })
    expect(await notificationsOf(youngest!)).toEqual([])
  })

  it('never reveals the Discord invite in a notification that is not room_ready', async () => {
    const [hostA, owner, heir] = await people('Host A', 'Owner', 'Heir')
    const a = await squad(hostA!, 2)
    const b = await squad(owner!, 3)
    await join(heir!, b)
    await join(owner!, a)

    const response = await get(server, '/api/notifications', heir!)

    expect(response.body).not.toContain(DISCORD_INVITE)
    expect(
      response.json<{ notifications: { payload: object }[] }>().notifications[0]!.payload
    ).not.toHaveProperty('discordLink')
  })

  it('breaks a tie on joinedAt with the smaller userId', async () => {
    const [hostA, owner, first, second] = await people('Host A', 'Owner', 'First', 'Second')
    const a = await squad(hostA!, 2)
    const b = await squad(owner!, 4)
    await join(first!, b)
    await join(second!, b)
    const sameInstant = new Date('2026-01-01T00:00:00.000Z')
    await server.app.db
      .update(roomMembers)
      .set({ joinedAt: sameInstant })
      .where(eq(roomMembers.roomId, b.id))

    await join(owner!, a)

    expect((await findRoomRow(server, b.id))?.hostId).toBe(sorted(first!, second!)[0])
  })

  it('skips a member who already hosts another Open Squad', async () => {
    const [hostA, owner, busy, free] = await people('Host A', 'Owner', 'Busy', 'Free')
    const a = await squad(hostA!, 2)
    const b = await squad(owner!, 4)
    await join(busy!, b)
    await join(free!, b)
    await squad(busy!, 3)

    await join(owner!, a)

    expect((await findRoomRow(server, b.id))?.hostId).toBe(free!.id)
  })

  it('gives a person who would inherit two Squads only the one with the smaller id', async () => {
    const [hostA, owner1, owner2, heir, other1, other2] = await people(
      'Host A',
      'Owner 1',
      'Owner 2',
      'Heir',
      'Other 1',
      'Other 2'
    )
    const a = await squad(hostA!, 3)
    const b1 = await squad(owner1!, 4)
    const b2 = await squad(owner2!, 4)
    await join(heir!, b1)
    await join(heir!, b2)
    await join(other1!, b1)
    await join(other2!, b2)
    await join(owner1!, a)

    await join(owner2!, a)

    const [first, second] = [b1, b2].sort((left, right) => left.id.localeCompare(right.id))
    const hosts = {
      [b1.id]: (await findRoomRow(server, b1.id))?.hostId,
      [b2.id]: (await findRoomRow(server, b2.id))?.hostId,
    }
    expect(hosts[first!.id]).toBe(heir!.id)
    expect(hosts[second!.id]).toBe(second!.id === b1.id ? other1!.id : other2!.id)
    expect(Object.values(hosts).filter((hostId) => hostId === heir!.id)).toHaveLength(1)
  })
})

describe('the Squad Release tells the host a member left', () => {
  it('sends one member_left per leaver and keeps the host, the invite and the other members', async () => {
    const [hostA, hostB, first, second, stayer] = await people(
      'Host A',
      'Host B',
      'First',
      'Second',
      'Stayer'
    )
    const a = await squad(hostA!, 3, 'Squad A')
    const b = await squad(hostB!, 5, 'Squad B')
    await join(first!, b)
    await join(second!, b)
    await join(stayer!, b)
    await join(first!, a)

    await join(second!, a)

    expect(await memberIds(b)).toEqual(sorted(hostB!, stayer!))
    const row = await findRoomRow(server, b.id)
    expect(row?.hostId).toBe(hostB!.id)
    expect(row?.lastActivityAt).toEqual(clock.now())

    const told = await notificationsOf(hostB!)
    expect(told.map((n) => n.type)).toEqual(['member_left', 'member_left'])
    expect(told.map((n) => (n.type === 'member_left' ? n.payload.member.name : '')).sort()).toEqual(
      ['First', 'Second']
    )
    expect(told[0]).toMatchObject({
      payload: { roomId: b.id, roomCode: b.code, reason: 'squad_completed' },
    })
    expect(await notificationsOf(stayer!)).toEqual([])
    for (const leaver of [first!, second!]) {
      const ready = (await notificationsOf(leaver)).filter((n) => n.type === 'room_ready')
      expect(roomReadyPayload(ready[0]).leftSquads).toEqual([
        { roomCode: b.code, roomName: b.name },
      ])
    }
  })

  it('sends two notifications to the same host for two Squads that filled one after the other', async () => {
    const [hostB, hostA1, hostA2, first, second] = await people(
      'Host B',
      'Host A1',
      'Host A2',
      'First',
      'Second'
    )
    const b = await squad(hostB!, 5)
    await join(first!, b)
    await join(second!, b)
    const a1 = await squad(hostA1!, 2)
    const a2 = await squad(hostA2!, 2)

    await join(first!, a1)
    await join(second!, a2)

    const told = await notificationsOf(hostB!)
    expect(told.map((n) => n.type)).toEqual(['member_left', 'member_left'])
    expect(told.map((n) => (n.type === 'member_left' ? n.payload.member.name : '')).sort()).toEqual(
      ['First', 'Second']
    )
    expect(await memberIds(b)).toEqual([hostB!.id])
  })
})

describe('the Squad Release ends a Squad that cannot go on', () => {
  it('closes a Squad whose remaining members all host another Open Squad, and tells them', async () => {
    const [hostA, owner, busy] = await people('Host A', 'Owner', 'Busy')
    const a = await squad(hostA!, 2)
    const b = await squad(owner!, 4, 'Squad B')
    await join(busy!, b)
    const c = await squad(busy!, 3)
    const activityOfC = (await findRoomRow(server, c.id))?.lastActivityAt

    await join(owner!, a)

    expect(await findRoomRow(server, b.id)).toBeNull()
    expect(await memberIds(b)).toEqual([])
    const told = await notificationsOf(busy!)
    expect(told).toHaveLength(1)
    expect(told[0]).toMatchObject({
      type: 'room_closed',
      payload: {
        roomId: b.id,
        roomCode: b.code,
        roomName: 'Squad B',
        previousHost: { name: 'Owner' },
        reason: 'no_eligible_host',
      },
    })
    const stillHosted = await findRoomRow(server, c.id)
    expect(stillHosted?.hostId).toBe(busy!.id)
    expect(stillHosted?.lastActivityAt).toEqual(activityOfC)
    expect(roomReadyPayload((await notificationsOf(owner!))[0]).leftSquads).toEqual([
      { roomCode: b.code, roomName: 'Squad B' },
    ])
  })

  it('deletes a Squad nobody is left in, and tells nobody but the Squad that filled', async () => {
    const [hostA, owner] = await people('Host A', 'Owner')
    const a = await squad(hostA!, 2)
    const b = await squad(owner!, 4, 'Squad B')

    await join(owner!, a)

    expect(await findRoomRow(server, b.id)).toBeNull()
    const stored = await server.app.db.select().from(userNotifications)
    expect(stored.map((row) => row.type)).toEqual(['room_ready', 'room_ready'])
    expect(roomReadyPayload((await notificationsOf(owner!))[0]).leftSquads).toEqual([
      { roomCode: b.code, roomName: 'Squad B' },
    ])
  })
})

describe('what the Squad Release leaves alone', () => {
  it('keeps the Memberships in Ready and expired Squads and releases only the Open one', async () => {
    const [hostR, hostE, hostB, hostA, user] = await people(
      'Host R',
      'Host E',
      'Host B',
      'Host A',
      'User'
    )
    const ready = await squad(hostR!, 2)
    await join(user!, ready)
    const expired = await squad(hostE!, 3)
    await join(user!, expired)
    await setRoomLifecycle(server, expired.id, {
      createdAt: new Date(clock.now().getTime() - ROOM.OPEN_ROOM_TTL_MS),
      lastActivityAt: new Date(clock.now().getTime() - ROOM.OPEN_ROOM_TTL_MS),
      readyAt: null,
    })
    const open = await squad(hostB!, 3)
    await join(user!, open)
    const a = await squad(hostA!, 2)
    const expiredBefore = await findRoomRow(server, expired.id)

    await join(user!, a)

    expect(await memberIds(ready)).toEqual(sorted(hostR!, user!))
    expect(await memberIds(expired)).toEqual(sorted(hostE!, user!))
    expect(await findRoomRow(server, expired.id)).toEqual(expiredBefore)
    expect(await memberIds(open)).toEqual([hostB!.id])
    expect(await notificationsOf(hostE!)).toEqual([])
    const [latest] = await notificationsOf(user!)
    expect(roomReadyPayload(latest).leftSquads).toEqual([
      { roomCode: open.code, roomName: open.name },
    ])
  })

  it('releases nobody when the join does not fill the Squad', async () => {
    const [hostA, hostB, user] = await people('Host A', 'Host B', 'User')
    const a = await squad(hostA!, 3)
    const b = await squad(hostB!, 3)
    await join(user!, b)

    await join(user!, a)

    expect(await memberIds(a)).toEqual(sorted(hostA!, user!))
    expect(await memberIds(b)).toEqual(sorted(hostB!, user!))
    expect(await notificationsOf(hostB!)).toEqual([])
  })

  it('still deletes the Squad when its host leaves by hand', async () => {
    const [hostB, member] = await people('Host B', 'Member')
    const b = await squad(hostB!, 3)
    await join(member!, b)

    const response = await roomAction(server, hostB!, b.code, 'leave')

    expect(response.statusCode).toBe(200)
    expect(await findRoomRow(server, b.id)).toBeNull()
    expect(await notificationsOf(member!)).toEqual([])
  })
})
