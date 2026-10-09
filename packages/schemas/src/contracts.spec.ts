import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  describeContractIssues,
  isRoomLobbyResponse,
  notificationsResponseSchema,
  publicRoomSchema,
  roomCodeParamSchema,
  roomLobbyResponseSchema,
  roomMemberSchema,
  roomResponseSchema,
  roomSchema,
  roomsResponseSchema,
  userNotificationSchema,
} from './index'
import { gameSchema } from './game'
import { isoDateTimeSchema } from './date'
import { userSchema } from './user'
import type { UserNotificationPayloadDto } from './notification'
import type {
  GameDto,
  PublicRoomDto,
  RoomDto,
  RoomMemberDto,
  RoomsResponse,
  UserDto,
  UserNotificationDto,
} from './index'

const ROOM_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const GAME_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const INVITE = 'https://discord.gg/squadzr'
const CREATED_AT = '2026-09-27T12:30:00.000Z'

const publicRoom = {
  id: ROOM_ID,
  code: 'ABC123',
  name: 'Ranked 5v5',
  hostId: 'user-1',
  gameId: GAME_ID,
  maxPlayers: 5,
  tags: ['ranked'],
  language: 'en',
  memberCount: 2,
  isMember: false,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
}
const memberRoom = { ...publicRoom, discordLink: INVITE }
const players = [{ id: 'user-1', name: 'Caio', image: null, isHost: true }]

describe('isoDateTimeSchema', () => {
  it('accepts the ISO 8601 UTC string a JSON date is serialized to', () => {
    expect(isoDateTimeSchema.parse(CREATED_AT)).toBe(CREATED_AT)
    expect(isoDateTimeSchema.parse(new Date(0).toISOString())).toBe('1970-01-01T00:00:00.000Z')
  })

  it.each([
    ['a Date instance', new Date(0)],
    ['an epoch number', 1_769_000_000_000],
    ['a date without time', '2026-09-27'],
    ['a local time without offset', '2026-09-27T12:30:00'],
    ['free text', 'yesterday'],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(isoDateTimeSchema.safeParse(value).success).toBe(false)
  })
})

describe('transport dates', () => {
  it('keeps every date field as the ISO string that travelled in JSON', () => {
    const game = gameSchema.parse({
      id: GAME_ID,
      name: 'Counter-Strike 2',
      slug: 'cs2',
      coverUrl: 'https://cdn.squadzr.test/cs2.webp',
      minPlayers: 2,
      maxPlayers: 5,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    })
    const member = roomMemberSchema.parse({
      id: ROOM_ID,
      roomId: ROOM_ID,
      userId: 'user-1',
      joinedAt: CREATED_AT,
    })

    expect(game.createdAt).toBe(CREATED_AT)
    expect(member.joinedAt).toBe(CREATED_AT)
    expect(roomSchema.parse(memberRoom).updatedAt).toBe(CREATED_AT)
  })

  it('rejects a room whose dates are not ISO strings', () => {
    expect(
      publicRoomSchema.safeParse({ ...publicRoom, createdAt: 1_769_000_000_000 }).success
    ).toBe(false)
    expect(publicRoomSchema.safeParse({ ...publicRoom, updatedAt: 'soon' }).success).toBe(false)
  })

  it('accepts a notification that was never read and one read at an ISO instant', () => {
    const notification = {
      id: ROOM_ID,
      userId: 'user-1',
      type: 'room_ready',
      title: 'Room ready',
      message: 'Ranked 5v5 is ready.',
      payload: {
        roomId: ROOM_ID,
        roomCode: 'ABC123',
        roomName: 'Ranked 5v5',
        gameName: 'Counter-Strike 2',
        players: [{ name: 'Caio', image: null }],
        discordLink: INVITE,
      },
      readAt: null,
      createdAt: CREATED_AT,
    }

    expect(userNotificationSchema.parse(notification).readAt).toBeNull()
    expect(userNotificationSchema.parse({ ...notification, readAt: CREATED_AT }).readAt).toBe(
      CREATED_AT
    )
    expect(
      notificationsResponseSchema.safeParse({
        notifications: [{ ...notification, readAt: new Date(0) }],
      }).success
    ).toBe(false)
  })

  it('infers transport types whose dates are strings', () => {
    expectTypeOf<UserDto['id']>().toEqualTypeOf<string>()
    expectTypeOf<UserDto['image']>().toEqualTypeOf<string | null>()
    expectTypeOf<UserDto['createdAt']>().toEqualTypeOf<string>()
    expectTypeOf<GameDto['minPlayers']>().toEqualTypeOf<number>()
    expectTypeOf<GameDto['updatedAt']>().toEqualTypeOf<string>()
    expectTypeOf<RoomDto['tags']>().toEqualTypeOf<string[]>()
    expectTypeOf<RoomDto['createdAt']>().toEqualTypeOf<string>()
    expectTypeOf<RoomMemberDto['joinedAt']>().toEqualTypeOf<string>()
    expectTypeOf<UserNotificationDto['readAt']>().toEqualTypeOf<string | null>()
    expectTypeOf<UserNotificationDto['payload']>().toEqualTypeOf<UserNotificationPayloadDto>()
    expectTypeOf(userSchema.parse).returns.toEqualTypeOf<UserDto>()
  })
})

describe('public and private room projections', () => {
  it('drops the Discord invite from the public projection', () => {
    const parsed = publicRoomSchema.parse(memberRoom)

    expect(parsed).toEqual(publicRoom)
    expect(parsed).not.toHaveProperty('discordLink')
  })

  it('requires the Discord invite field on the private projection', () => {
    expect(roomSchema.parse(memberRoom).discordLink).toBe(INVITE)
    expect(roomSchema.parse({ ...publicRoom, discordLink: null }).discordLink).toBeNull()
    expect(roomSchema.safeParse(publicRoom).success).toBe(false)
  })

  it('applies the wire defaults for tags and language', () => {
    const { tags: _tags, language: _language, ...minimal } = publicRoom

    expect(publicRoomSchema.parse(minimal)).toMatchObject({ tags: [], language: 'pt-br' })
  })

  it('never lets an invite or a roster through the catalog response', () => {
    const parsed = roomsResponseSchema.parse({ rooms: [memberRoom], players })

    expect(JSON.stringify(parsed)).not.toContain(INVITE)
    expect(parsed).toEqual({ rooms: [publicRoom] })
  })

  it('does not expose discordLink or a roster on the public types', () => {
    expectTypeOf<PublicRoomDto>().not.toHaveProperty('discordLink')
    expectTypeOf<RoomsResponse['rooms'][number]>().toEqualTypeOf<PublicRoomDto>()
    expectTypeOf<RoomsResponse>().not.toHaveProperty('players')
    expectTypeOf<RoomDto['discordLink']>().toEqualTypeOf<string | null>()
  })
})

describe('roomResponseSchema', () => {
  it('keeps the invite and the roster of a member response', () => {
    const parsed = roomResponseSchema.parse({ room: memberRoom, players })

    expect(parsed).toEqual({ room: memberRoom, players })
    expect(isRoomLobbyResponse(parsed)).toBe(true)
  })

  it('reads a non-member response as the public projection', () => {
    const parsed = roomResponseSchema.parse({ room: publicRoom })

    expect(parsed).toEqual({ room: publicRoom })
    expect(isRoomLobbyResponse(parsed)).toBe(false)
  })

  it.each([
    ['a roster that is not a list', { room: memberRoom, players: 'invalid-roster' }, ['players']],
    [
      'a roster entry with a wrong field type',
      { room: memberRoom, players: [{ id: 'u1', name: 42, image: null, isHost: true }] },
      ['players.0.name'],
    ],
    [
      'an invite that is not a URL',
      { room: { ...memberRoom, discordLink: 'not a url' }, players },
      ['room.discordLink'],
    ],
  ])('rejects %s instead of downgrading it to the public projection', (_label, payload, paths) => {
    const result = roomResponseSchema.safeParse(payload)

    expect(roomLobbyResponseSchema.safeParse(payload).success).toBe(false)
    if (result.success) throw new Error('expected an invalid response')
    expect(describeContractIssues(result.error).map((issue) => issue.path)).toEqual(paths)
  })

  // Half of the lobby details is neither projection: the missing half and the
  // unexpected half are both reported.
  it.each([
    ['an invite without a roster', { room: memberRoom }],
    ['a null invite without a roster', { room: { ...publicRoom, discordLink: null } }],
    ['a roster without an invite', { room: publicRoom, players }],
    ['an empty roster without an invite', { room: publicRoom, players: [] }],
  ])('rejects %s', (_label, payload) => {
    const result = roomResponseSchema.safeParse(payload)

    if (result.success) throw new Error('expected an invalid response')
    expect(
      describeContractIssues(result.error)
        .map((issue) => issue.path)
        .sort()
    ).toEqual(['players', 'room.discordLink'])
  })

  it('keeps ignoring unknown fields that are not lobby details', () => {
    const parsed = roomResponseSchema.parse({
      room: { ...publicRoom, futureField: 1 },
      futureField: 1,
    })

    expect(parsed).toEqual({ room: publicRoom })
  })

  it('rejects a response without a valid room', () => {
    expect(roomResponseSchema.safeParse({ players }).success).toBe(false)
    expect(roomResponseSchema.safeParse({ room: { ...publicRoom, id: 'nope' } }).success).toBe(
      false
    )
  })
})

describe('roomCodeParamSchema', () => {
  it('uppercases a 6-character code and rejects any other length', () => {
    expect(roomCodeParamSchema.parse({ code: 'abc123' })).toEqual({ code: 'ABC123' })
    expect(roomCodeParamSchema.safeParse({ code: 'abc' }).success).toBe(false)
  })
})

describe('describeContractIssues', () => {
  it('reports where and what kind of issue, never the offending value', () => {
    const result = roomSchema.safeParse({
      ...memberRoom,
      discordLink: 'not-a-url-but-secret',
      createdAt: 42,
    })
    if (result.success) throw new Error('expected an invalid room')

    const issues = describeContractIssues(result.error)

    expect(issues).toEqual(
      expect.arrayContaining([
        { path: 'createdAt', code: 'invalid_type' },
        { path: 'discordLink', code: 'invalid_format' },
      ])
    )
    expect(JSON.stringify(issues)).not.toContain('secret')
    for (const issue of issues) expect(Object.keys(issue).sort()).toEqual(['code', 'path'])
  })

  it('locates the issue inside the branches of a union, once', () => {
    const result = roomResponseSchema.safeParse({
      room: { ...memberRoom, createdAt: 'yesterday' },
      players,
    })
    if (result.success) throw new Error('expected an invalid response')

    expect(describeContractIssues(result.error)).toEqual([
      { path: 'room.createdAt', code: 'invalid_format' },
    ])
  })
})
