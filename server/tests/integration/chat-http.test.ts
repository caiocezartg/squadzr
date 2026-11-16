import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { count, eq } from 'drizzle-orm'
import {
  CHAT,
  chatHistoryResponseSchema,
  chatMessageSchema,
  type ChatHistoryResponse,
  type ChatMessageDto,
} from '@squadzr/schemas'
import { chatMessages } from '@infrastructure/database/schema/chat-messages'
import { user } from '@infrastructure/database/schema/auth'
import { signIn, type TestUser } from '@test/harness/auth'
import { FakeClock } from '@test/harness/clock'
import {
  createRoom,
  get,
  insertGame,
  joinAll,
  roomAction,
  setRoomLifecycle,
} from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// Characterizes the Squad Chat HTTP contract against PostgreSQL: who can read and send,
// the idempotent send, the stored instant and the history that dies with its Squad.

const START = new Date('2026-06-01T12:00:00.123Z')

let server: TestServer
let clock: FakeClock
let host: TestUser
let member: TestUser
let outsider: TestUser
let code: string
let roomId: string

beforeEach(async () => {
  clock = new FakeClock(START)
  server = await buildTestServer({}, { clock })
  host = await signIn(server, 'Host')
  member = await signIn(server, 'Member')
  outsider = await signIn(server, 'Outsider')
  const game = await insertGame(server)
  const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 5 })
  code = room.code
  roomId = room.id
  await joinAll(server, code, [member])
})

afterEach(async () => {
  await server.close()
})

function send(actor: TestUser | null, body: { id?: string; body: string }, roomCode = code) {
  return server.app.inject({
    method: 'POST',
    url: `/api/rooms/${roomCode}/messages`,
    headers: actor?.headers,
    payload: { id: randomUUID(), ...body },
  })
}

async function history(actor: TestUser, before?: string): Promise<ChatHistoryResponse> {
  const query = before ? `?before=${before}` : ''
  const response = await get(server, `/api/rooms/${code}/messages${query}`, actor)
  expect(response.statusCode, response.body).toBe(200)
  return chatHistoryResponseSchema.parse(response.json())
}

async function storedCount(): Promise<number> {
  const [row] = await server.app.db
    .select({ total: count() })
    .from(chatMessages)
    .where(eq(chatMessages.roomId, roomId))
  return row?.total ?? 0
}

describe('access', () => {
  it('answers a visitor 401 on both routes', async () => {
    const read = await get(server, `/api/rooms/${code}/messages`)
    const write = await send(null, { body: 'oi' })

    expect(read.statusCode).toBe(401)
    expect(write.statusCode).toBe(401)
  })

  it('answers a non-member 422 on both routes and stores nothing', async () => {
    const read = await get(server, `/api/rooms/${code}/messages`, outsider)
    const write = await send(outsider, { body: 'oi' })

    expect(read.statusCode).toBe(422)
    expect(read.json()).toMatchObject({ error: 'NOT_ROOM_MEMBER' })
    expect(write.statusCode).toBe(422)
    expect(await storedCount()).toBe(0)
  })

  it('answers a missing Squad 404 on both routes', async () => {
    const read = await get(server, '/api/rooms/ZZZZZZ/messages', member)
    const write = await send(member, { body: 'oi' }, 'ZZZZZZ')

    expect(read.statusCode).toBe(404)
    expect(write.statusCode).toBe(404)
  })

  it('lets a member read a Ready Squad but hides it from a non-member', async () => {
    const readyGame = await insertGame(server, 2)
    const ready = await createRoom(server, outsider, { gameId: readyGame.id, maxPlayers: 2 })
    const fourth = await signIn(server, 'Fourth')
    await joinAll(server, ready.code, [fourth])

    const asMember = await get(server, `/api/rooms/${ready.code}/messages`, fourth)
    const asStranger = await get(server, `/api/rooms/${ready.code}/messages`, member)

    expect(asMember.statusCode).toBe(200)
    expect(asStranger.statusCode).toBe(404)
  })
})

describe('sending', () => {
  it('stores a member message and answers 201 with it', async () => {
    const id = randomUUID()

    const response = await send(member, { id, body: '  oi, time!  ' })

    expect(response.statusCode, response.body).toBe(201)
    const message = chatMessageSchema.parse(response.json())
    expect(message).toMatchObject({
      id,
      roomCode: code,
      body: 'oi, time!',
      author: { id: member.id, name: 'Member', image: member.image },
    })
    expect(await storedCount()).toBe(1)
  })

  it('answers a retry of the same id with 200 and the stored message', async () => {
    const id = randomUUID()
    const first = await send(member, { id, body: 'first' })
    clock.advance(5_000)

    const retry = await send(member, { id, body: 'first' })

    expect(retry.statusCode, retry.body).toBe(200)
    expect(retry.json()).toEqual(first.json())
    expect(await storedCount()).toBe(1)
  })

  it('keeps the stored body when a retry with the same id carries another body', async () => {
    const id = randomUUID()
    await send(member, { id, body: 'original' })

    const retry = await send(member, { id, body: 'edited' })

    expect(retry.statusCode).toBe(200)
    expect(retry.json<ChatMessageDto>().body).toBe('original')
  })

  it('answers 409 when the id belongs to another author', async () => {
    const id = randomUUID()
    await send(host, { id, body: 'mine' })

    const clash = await send(member, { id, body: 'not yours' })

    expect(clash.statusCode, clash.body).toBe(409)
    expect(clash.json()).toMatchObject({ error: 'CHAT_MESSAGE_ID_CONFLICT' })
    expect(await storedCount()).toBe(1)
  })

  it('answers 409 when the id belongs to another Squad', async () => {
    const otherGame = await insertGame(server)
    const other = await createRoom(server, member, { gameId: otherGame.id, maxPlayers: 5 })
    const id = randomUUID()
    await send(member, { id, body: 'elsewhere' }, other.code)

    const clash = await send(member, { id, body: 'here' })

    expect(clash.statusCode, clash.body).toBe(409)
  })

  it('stores exactly one message for parallel sends of the same id', async () => {
    const id = randomUUID()

    const responses = await Promise.all(
      Array.from({ length: 6 }, () => send(member, { id, body: 'parallel' }))
    )

    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      200, 200, 200, 200, 200, 201,
    ])
    expect(await storedCount()).toBe(1)
  })

  it('writes created_at from the app clock with millisecond precision', async () => {
    const id = randomUUID()

    const response = await send(member, { id, body: 'tick' })

    expect(response.json<ChatMessageDto>().createdAt).toBe('2026-06-01T12:00:00.123Z')
    const [row] = await server.app.db.select().from(chatMessages).where(eq(chatMessages.id, id))
    expect(row?.createdAt.getTime()).toBe(START.getTime())
  })
})

describe('body validation', () => {
  it.each([
    ['whitespace only', '   \n  '],
    ['zero-width only', '​‌‍﻿'],
    ['too long', 'a'.repeat(CHAT.MESSAGE_MAX_LENGTH + 1)],
    [
      'too many line breaks',
      Array(CHAT.MESSAGE_MAX_LINE_BREAKS + 2)
        .fill('a')
        .join('\n'),
    ],
    ['a link', 'entra aí discord.gg/abc123'],
  ])('refuses a body that is %s', async (_label, body) => {
    const response = await send(member, { body })

    expect(response.statusCode, response.body).toBe(400)
    expect(await storedCount()).toBe(0)
  })

  it('stores a compound emoji whole, zero-width joiners included', async () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}'

    const response = await send(member, { body: ` ${family} ` })

    expect(response.statusCode, response.body).toBe(201)
    expect(response.json<ChatMessageDto>().body).toBe(family)
  })

  it('refuses an id that is not a UUID', async () => {
    const response = await send(member, { id: 'not-a-uuid', body: 'oi' })

    expect(response.statusCode).toBe(400)
  })
})

describe('history', () => {
  it('lists the messages oldest first with the author as they are now', async () => {
    await send(host, { body: 'one' })
    clock.advance(1_000)
    await send(member, { body: 'two' })
    await server.app.db.update(user).set({ name: 'Renamed' }).where(eq(user.id, member.id))

    const { items, hasMore } = await history(host)

    expect(hasMore).toBe(false)
    expect(items.map((message) => message.body)).toEqual(['one', 'two'])
    expect(items[1]?.author).toMatchObject({ id: member.id, name: 'Renamed' })
  })

  it('returns the latest page with hasMore when the history is longer', async () => {
    const rows = Array.from({ length: CHAT.HISTORY_PAGE_SIZE + 1 }, (_, index) => ({
      id: randomUUID(),
      roomId,
      authorId: member.id,
      body: `message ${index + 1}`,
      createdAt: new Date(START.getTime() + index * 1_000),
    }))
    await server.app.db.insert(chatMessages).values(rows)

    const { items, hasMore } = await history(member)

    expect(hasMore).toBe(true)
    expect(items).toHaveLength(CHAT.HISTORY_PAGE_SIZE)
    expect(items[0]?.body).toBe('message 2')
    expect(items.at(-1)?.body).toBe(`message ${CHAT.HISTORY_PAGE_SIZE + 1}`)
  })

  it('orders messages sent in the same millisecond deterministically', async () => {
    await send(host, { body: 'a' })
    await send(member, { body: 'b' })

    const first = await history(host)
    const second = await history(member)

    expect(first.items.map((message) => message.id)).toEqual(
      second.items.map((message) => message.id)
    )
    expect(first.items).toHaveLength(2)
  })

  it('keeps a departed member messages but refuses them the chat', async () => {
    await send(member, { body: 'before leaving' })
    const left = await roomAction(server, member, code, 'leave')
    expect(left.statusCode, left.body).toBe(200)

    const asHost = await history(host)
    const asDeparted = await get(server, `/api/rooms/${code}/messages`, member)
    const write = await send(member, { body: 'after leaving' })

    expect(asHost.items.map((message) => message.body)).toEqual(['before leaving'])
    expect(asDeparted.statusCode).toBe(422)
    expect(write.statusCode).toBe(422)
    expect(await storedCount()).toBe(1)
  })
})

describe('history cursor', () => {
  async function seed(total: number, targetRoomId = roomId, authorId = member.id) {
    const rows = Array.from({ length: total }, (_, index) => ({
      id: randomUUID(),
      roomId: targetRoomId,
      authorId,
      body: `message ${index + 1}`,
      createdAt: new Date(START.getTime() + index * 1_000),
    }))
    await server.app.db.insert(chatMessages).values(rows)
    return rows
  }

  it('returns the page before the cursor, oldest first, with hasMore', async () => {
    const total = CHAT.HISTORY_PAGE_SIZE * 2 + 5
    const rows = await seed(total)
    const latest = await history(member)
    const oldestHeld = latest.items[0]!

    const older = await history(member, oldestHeld.id)

    expect(oldestHeld.body).toBe(`message ${total - CHAT.HISTORY_PAGE_SIZE + 1}`)
    expect(older.hasMore).toBe(true)
    expect(older.items).toHaveLength(CHAT.HISTORY_PAGE_SIZE)
    expect(older.items.at(-1)?.id).toBe(rows[total - CHAT.HISTORY_PAGE_SIZE - 1]?.id)
    expect(older.items[0]?.body).toBe(`message ${total - CHAT.HISTORY_PAGE_SIZE * 2 + 1}`)

    const oldest = await history(member, older.items[0]!.id)
    expect(oldest.hasMore).toBe(false)
    expect(oldest.items.map((message) => message.body)).toEqual([
      'message 1',
      'message 2',
      'message 3',
      'message 4',
      'message 5',
    ])
  })

  it('walks the whole history without gaps or repeats', async () => {
    const total = CHAT.HISTORY_PAGE_SIZE + 7
    const rows = await seed(total)

    const collected: string[] = []
    let page = await history(member)
    collected.unshift(...page.items.map((message) => message.id))
    while (page.hasMore) {
      page = await history(member, collected[0])
      collected.unshift(...page.items.map((message) => message.id))
    }

    expect(collected).toEqual(rows.map((row) => row.id))
  })

  it('orders messages stored in the same millisecond by id across the cursor', async () => {
    const createdAt = new Date(START.getTime())
    const ids = [randomUUID(), randomUUID(), randomUUID()].sort()
    await server.app.db
      .insert(chatMessages)
      .values(
        ids.map((id, index) => ({ id, roomId, authorId: member.id, body: `m${index}`, createdAt }))
      )

    const older = await history(member, ids[2])

    expect(older.items.map((message) => message.id)).toEqual([ids[0], ids[1]])
    expect(older.hasMore).toBe(false)
  })

  it('answers an unknown cursor with an empty page', async () => {
    await seed(3)

    const page = await history(member, randomUUID())

    expect(page).toEqual({ items: [], hasMore: false })
  })

  it('answers a cursor from another Squad with an empty page', async () => {
    await seed(3)
    const otherGame = await insertGame(server)
    const other = await createRoom(server, outsider, { gameId: otherGame.id, maxPlayers: 5 })
    const foreign = (await seed(2, other.id, outsider.id))[1]!

    const page = await history(member, foreign.id)

    expect(page).toEqual({ items: [], hasMore: false })
  })

  it('refuses a cursor that is not a UUID with 400', async () => {
    const response = await get(server, `/api/rooms/${code}/messages?before=not-a-uuid`, member)

    expect(response.statusCode).toBe(400)
  })

  it('still refuses a non-member who sends a valid cursor', async () => {
    const [first] = await seed(1)

    const response = await get(server, `/api/rooms/${code}/messages?before=${first!.id}`, outsider)

    expect(response.statusCode).toBe(422)
  })
})

describe('Squad lifecycle', () => {
  it('deletes the messages with the Squad when the host leaves', async () => {
    await send(host, { body: 'one' })
    await send(member, { body: 'two' })
    expect(await storedCount()).toBe(2)

    const left = await roomAction(server, host, code, 'leave')

    expect(left.statusCode, left.body).toBe(200)
    expect(await storedCount()).toBe(0)
  })

  it('treats an expired Squad as not found', async () => {
    await setRoomLifecycle(server, roomId, {
      createdAt: new Date(START.getTime() - 48 * 3_600_000),
      lastActivityAt: new Date(START.getTime() - 48 * 3_600_000),
      readyAt: null,
    })

    const read = await get(server, `/api/rooms/${code}/messages`, host)

    expect(read.statusCode).toBe(404)
  })
})

describe('rate limit', () => {
  /** Sends `total` messages from `actor`, one millisecond apart, and expects each to be stored. */
  async function sendBurst(actor: TestUser, total: number): Promise<void> {
    for (let i = 0; i < total; i++) {
      const response = await send(actor, { body: `burst ${i}` })
      expect(response.statusCode, response.body).toBe(201)
      clock.advance(1)
    }
  }

  it('answers the sixth message in a window 429 with the wait in body and header', async () => {
    await sendBurst(member, CHAT.RATE_LIMIT)

    const refused = await send(member, { body: 'one too many' })

    expect(refused.statusCode, refused.body).toBe(429)
    // The oldest message is 5ms old: it leaves the window in 9995ms, which rounds up to 10s.
    expect(refused.json()).toEqual({
      error: 'CHAT_RATE_LIMITED',
      message: 'You are sending messages too fast. Try again shortly.',
      retryAfterMs: CHAT.RATE_WINDOW_MS - CHAT.RATE_LIMIT,
    })
    expect(refused.headers['retry-after']).toBe('10')
    expect(await storedCount()).toBe(CHAT.RATE_LIMIT)
  })

  it('lets the browser app read Retry-After across origins', async () => {
    await sendBurst(member, CHAT.RATE_LIMIT)

    const refused = await server.app.inject({
      method: 'POST',
      url: `/api/rooms/${code}/messages`,
      headers: { ...member.headers, origin: 'http://localhost:5173' },
      payload: { id: randomUUID(), body: 'one too many' },
    })

    expect(refused.statusCode).toBe(429)
    expect(refused.headers['access-control-expose-headers']).toMatch(/retry-after/i)
  })

  it('rounds a sub-second wait up in the header', async () => {
    await sendBurst(member, CHAT.RATE_LIMIT)
    clock.advance(CHAT.RATE_WINDOW_MS - 1_500)

    const refused = await send(member, { body: 'soon' })

    expect(refused.statusCode).toBe(429)
    expect(refused.json()).toMatchObject({ retryAfterMs: 1_495 })
    expect(refused.headers['retry-after']).toBe('2')
  })

  it('counts a message as out of the window exactly when it is window old', async () => {
    const firstAt = clock.now()
    await sendBurst(member, CHAT.RATE_LIMIT)
    // The oldest message is now one millisecond short of a full window: it still counts.
    clock.set(new Date(firstAt.getTime() + CHAT.RATE_WINDOW_MS - 1))

    const stillInside = await send(member, { body: 'edge - 1' })
    expect(stillInside.statusCode).toBe(429)
    expect(stillInside.json()).toMatchObject({ retryAfterMs: 1 })

    // Exactly a window old: it no longer counts, so a slot is free.
    clock.set(new Date(firstAt.getTime() + CHAT.RATE_WINDOW_MS))
    const onTheEdge = await send(member, { body: 'edge' })
    expect(onTheEdge.statusCode, onTheEdge.body).toBe(201)
  })

  it('does not let one member spend the limit of another', async () => {
    await sendBurst(member, CHAT.RATE_LIMIT)

    const other = await send(host, { body: 'my turn' })

    expect(other.statusCode, other.body).toBe(201)
  })

  it('keeps the limit per Squad', async () => {
    await sendBurst(member, CHAT.RATE_LIMIT)
    const game = await insertGame(server)
    const elsewhere = await createRoom(server, outsider, { gameId: game.id, maxPlayers: 5 })
    await joinAll(server, elsewhere.code, [member])

    const response = await send(member, { body: 'other squad' }, elsewhere.code)

    expect(response.statusCode, response.body).toBe(201)
  })

  it('answers a retry of a stored message with 200 even at the limit', async () => {
    const id = randomUUID()
    await send(member, { id, body: 'first' })
    await sendBurst(member, CHAT.RATE_LIMIT - 1)

    const retry = await send(member, { id, body: 'first' })

    expect(retry.statusCode, retry.body).toBe(200)
    expect(await storedCount()).toBe(CHAT.RATE_LIMIT)
  })

  it('does not count a retry of a stored message against the limit', async () => {
    const id = randomUUID()
    await send(member, { id, body: 'first' })
    await sendBurst(member, CHAT.RATE_LIMIT - 2)
    const retry = await send(member, { id, body: 'first' })

    const last = await send(member, { body: 'still within the limit' })

    expect(retry.statusCode, retry.body).toBe(200)
    expect(last.statusCode, last.body).toBe(201)
    expect(await storedCount()).toBe(CHAT.RATE_LIMIT)
  })

  it('lets the member send again once the window has passed', async () => {
    await sendBurst(member, CHAT.RATE_LIMIT)
    clock.advance(CHAT.RATE_WINDOW_MS + 1)

    const response = await send(member, { body: 'back' })

    expect(response.statusCode, response.body).toBe(201)
  })
})

describe('Ready Squad', () => {
  let readyCode: string
  let readyHost: TestUser
  let readyMember: TestUser

  beforeEach(async () => {
    readyHost = await signIn(server, 'Ready Host')
    readyMember = await signIn(server, 'Ready Member')
    const game = await insertGame(server, 2)
    const ready = await createRoom(server, readyHost, { gameId: game.id, maxPlayers: 2 })
    readyCode = ready.code
    await send(readyHost, { body: 'before ready' }, readyCode)
    await joinAll(server, readyCode, [readyMember])
  })

  it('refuses a send with 422 ROOM_READY and a chat-specific message, storing nothing', async () => {
    const response = await send(readyHost, { body: 'too late' }, readyCode)

    expect(response.statusCode, response.body).toBe(422)
    expect(response.json()).toMatchObject({ error: 'ROOM_READY' })
    expect(response.json<{ message: string }>().message).toMatch(/chat/i)
    const read = await get(server, `/api/rooms/${readyCode}/messages`, readyHost)
    expect(read.json<ChatHistoryResponse>().items.map((item) => item.body)).toEqual([
      'before ready',
    ])
  })

  it('keeps the history readable for every member', async () => {
    const read = await get(server, `/api/rooms/${readyCode}/messages`, readyMember)

    expect(read.statusCode, read.body).toBe(200)
    expect(chatHistoryResponseSchema.parse(read.json()).items).toHaveLength(1)
  })

  it('refuses a send from a non-member before telling them anything about the Squad', async () => {
    const response = await send(outsider, { body: 'hi' }, readyCode)

    expect(response.statusCode).toBe(404)
  })

  it('answers a retry of a message stored before Ready with 200, not a refusal', async () => {
    const first = await get(server, `/api/rooms/${readyCode}/messages`, readyHost)
    const [stored] = first.json<ChatHistoryResponse>().items

    const retry = await send(readyHost, { id: stored!.id, body: 'before ready' }, readyCode)

    expect(retry.statusCode, retry.body).toBe(200)
  })
})
