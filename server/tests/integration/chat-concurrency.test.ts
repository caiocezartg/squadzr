import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import pg from 'pg'
import { count, eq } from 'drizzle-orm'
import { CHAT } from '@squadzr/schemas'
import { chatMessages } from '@infrastructure/database/schema/chat-messages'
import { signIn, type TestUser } from '@test/harness/auth'
import { withinDeadline, waitForLockedSessions } from '@test/harness/locks'
import { createRoom, findRoomRow, insertGame, joinAll, roomAction } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// The rate rule and the Ready refusal are decided inside the send transaction, under the room
// row lock. A control session holds that lock while the requests arrive, so they overlap on
// it for sure: without the lock they would not park, and the barrier below would time out.

let server: TestServer
let control: pg.Client

beforeEach(async () => {
  server = await buildTestServer()
  control = new pg.Client({ connectionString: server.databaseUrl })
  await control.connect()
})

afterEach(async () => {
  await control.end()
  await server.close()
})

function send(actor: TestUser, code: string) {
  return server.app.inject({
    method: 'POST',
    url: `/api/rooms/${code}/messages`,
    headers: actor.headers,
    payload: { id: randomUUID(), body: 'oi' },
  })
}

async function storedCount(roomId: string): Promise<number> {
  const [row] = await server.app.db
    .select({ total: count() })
    .from(chatMessages)
    .where(eq(chatMessages.roomId, roomId))
  return row?.total ?? 0
}

/** Transaction ids that wrote each row: a lower one was committed before a higher one began writing. */
async function writerTransactions(roomId: string): Promise<{ message: number; room: number }> {
  const { rows } = await control.query<{ message: string; room: string }>(
    `SELECT (SELECT xmin::text::bigint FROM chat_messages WHERE room_id = $1 LIMIT 1) AS message,
            (SELECT xmin::text::bigint FROM rooms WHERE id = $1) AS room`,
    [roomId]
  )
  const [row] = rows
  return { message: Number(row!.message), room: Number(row!.room) }
}

async function holdRoomLock(roomId: string): Promise<void> {
  await control.query('BEGIN')
  await control.query('SELECT id FROM rooms WHERE id = $1 FOR UPDATE', [roomId])
}

describe('parallel sends of one member', () => {
  it(`never store more than ${CHAT.RATE_LIMIT} messages in a window`, async () => {
    const host = await signIn(server, 'Host')
    const member = await signIn(server, 'Member')
    const game = await insertGame(server)
    const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 5 })
    await joinAll(server, room.code, [member])
    const total = CHAT.RATE_LIMIT + 3

    await holdRoomLock(room.id)
    let transactionOpen = true
    const pending = Promise.all(Array.from({ length: total }, () => send(member, room.code)))
    try {
      await waitForLockedSessions(control, total)
      await control.query('COMMIT')
      transactionOpen = false
      const responses = await withinDeadline(pending, 'Parallel sends')

      const created = responses.filter((response) => response.statusCode === 201)
      const refused = responses.filter((response) => response.statusCode === 429)
      expect(created).toHaveLength(CHAT.RATE_LIMIT)
      expect(refused).toHaveLength(total - CHAT.RATE_LIMIT)
      for (const response of refused) {
        expect(response.json()).toMatchObject({ error: 'CHAT_RATE_LIMITED' })
      }
      expect(await storedCount(room.id)).toBe(CHAT.RATE_LIMIT)
    } finally {
      if (transactionOpen) await control.query('ROLLBACK')
      await pending.catch(() => undefined)
    }
  })
})

describe('a send racing the join that makes the Squad Ready', () => {
  it.each(['send', 'join'] as const)(
    'is stored before it or refused, with the %s reaching the lock first',
    async (first) => {
      const host = await signIn(server, 'Host')
      const joiner = await signIn(server, 'Joiner')
      const game = await insertGame(server, 2)
      const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 2 })
      const startSend = () => send(host, room.code)
      const startJoin = () => roomAction(server, joiner, room.code, 'join')

      await holdRoomLock(room.id)
      let transactionOpen = true
      // The lock queue is FIFO, so waiting for the first to park fixes who goes first.
      const firstPending = first === 'send' ? startSend() : startJoin()
      let secondPending: ReturnType<typeof startSend> | undefined
      try {
        await waitForLockedSessions(control, 1)
        secondPending = first === 'send' ? startJoin() : startSend()
        await waitForLockedSessions(control, 2)
        await control.query('COMMIT')
        transactionOpen = false
        const [sendResponse, joinResponse] = await withinDeadline(
          Promise.all(
            first === 'send' ? [firstPending, secondPending] : [secondPending, firstPending]
          ),
          'Racing send and join'
        )

        expect(joinResponse.statusCode, joinResponse.body).toBe(200)
        expect((await findRoomRow(server, room.id))?.readyAt).not.toBeNull()
        if (first === 'send') {
          expect(sendResponse.statusCode, sendResponse.body).toBe(201)
          expect(await storedCount(room.id)).toBe(1)
          const writers = await writerTransactions(room.id)
          expect(writers.message).toBeLessThan(writers.room)
        } else {
          expect(sendResponse.statusCode, sendResponse.body).toBe(422)
          expect(sendResponse.json()).toMatchObject({ error: 'ROOM_READY' })
          expect(await storedCount(room.id)).toBe(0)
        }
      } finally {
        if (transactionOpen) await control.query('ROLLBACK')
        await Promise.allSettled([firstPending, secondPending])
      }
    }
  )
})
