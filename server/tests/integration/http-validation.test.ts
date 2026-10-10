import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { errorResponseSchema } from '@squadzr/schemas'
import { userNotifications } from '@infrastructure/database/schema'
import { signIn, type TestUser } from '@test/harness/auth'
import {
  countMembers,
  createRoom,
  get,
  insertGame,
  postRoom,
  roomAction,
} from '@test/harness/rooms'
import { createLogCapture, type LogCapture } from '@test/harness/logging'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-62: HTTP input is validated once, by the route schema. Body, params and
// querystring each answer 400 VALIDATION_ERROR in the standard shape, a lowercase
// Squad code still resolves, and a persisted row that breaks its schema answers
// 500 and is logged exactly once.

let server: TestServer
let capture: LogCapture
let host: TestUser
let gameId: string

beforeEach(async () => {
  capture = createLogCapture('error')
  server = await buildTestServer({}, { logger: capture.logger })
  host = await signIn(server, 'Host')
  gameId = (await insertGame(server)).id
})

afterEach(async () => {
  await server.close()
})

describe('route schemas reject invalid input', () => {
  it.each([
    {
      input: 'body',
      request: () => postRoom(server, host, { gameId: 'not-a-uuid' }),
      message: /^body\/gameId /,
    },
    {
      input: 'params',
      request: () => get(server, '/api/games/not-a-uuid'),
      message: /^params\/id /,
    },
    {
      input: 'querystring',
      request: () => get(server, '/api/notifications?limit=0', host),
      message: /^querystring\/limit /,
    },
  ])('answers 400 VALIDATION_ERROR for an invalid $input', async ({ request, message }) => {
    const response = await request()

    expect(response.statusCode).toBe(400)
    expect(errorResponseSchema.parse(response.json())).toEqual({
      error: 'VALIDATION_ERROR',
      message: expect.stringMatching(message),
    })
  })
})

describe('route params', () => {
  it('resolves a lowercase Squad code for reading, joining and leaving', async () => {
    const member = await signIn(server, 'Member')
    const room = await createRoom(server, host, { gameId })
    const lowercase = room.code.toLowerCase()

    const read = await get(server, `/api/rooms/${lowercase}`, host)
    const joined = await roomAction(server, member, lowercase, 'join')
    const membersAfterJoin = await countMembers(server, room.id)
    const left = await roomAction(server, member, lowercase, 'leave')

    expect(read.statusCode).toBe(200)
    expect(read.json()).toMatchObject({ room: { id: room.id, code: room.code } })
    expect(joined.statusCode).toBe(200)
    expect(membersAfterJoin).toBe(2)
    expect(left.statusCode).toBe(200)
    expect(await countMembers(server, room.id)).toBe(1)
  })
})

describe('persisted rows', () => {
  it('answers 500 and logs the failure once when a row breaks its schema', async () => {
    const member = await signIn(server, 'Member')
    await server.app.db.insert(userNotifications).values({
      userId: member.id,
      type: 'retired_type',
      title: 'Room ready',
      message: 'Written before the type was retired',
      payload: {},
    })

    const response = await get(server, '/api/notifications', member)

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    })
    expect(capture.lines.map((line) => JSON.parse(line) as Record<string, unknown>)).toEqual([
      expect.objectContaining({
        msg: 'Unhandled error',
        method: 'GET',
        path: '/api/notifications',
        statusCode: 500,
      }),
    ])
  })
})
