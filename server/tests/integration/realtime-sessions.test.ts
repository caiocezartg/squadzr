import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MESSAGE_RATE_LIMIT } from '@infrastructure/websocket/message-rate'
import { session } from '@infrastructure/database/schema'
import { signIn, type TestUser } from '@test/harness/auth'
import { connect } from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// A socket keeps the session it opened with. Once that session ends (sign-out or
// expiry), the socket must stop receiving the member's lobby and notifications.

const SESSION_ENDED = 4001

let server: TestServer
let player: TestUser

beforeEach(async () => {
  server = await buildTestServer()
  player = await signIn(server, 'Player')
})

afterEach(async () => {
  await server.close()
})

async function endSessionsOf(user: TestUser): Promise<void> {
  await server.app.db.delete(session).where(eq(session.userId, user.id))
}

async function expireSessionsOf(user: TestUser): Promise<void> {
  await server.app.db
    .update(session)
    .set({ expiresAt: new Date(Date.now() - 1_000) })
    .where(eq(session.userId, user.id))
}

describe('realtime sessions', () => {
  it('closes the socket of a session that was signed out', async () => {
    const tab = await connect(server, player)
    await endSessionsOf(player)

    await server.app.realtime.revalidateSessions()

    expect(await tab.serverClosed).toEqual({ code: SESSION_ENDED, reason: 'Session ended' })
  })

  it('closes the socket of a session that expired', async () => {
    const tab = await connect(server, player)
    await expireSessionsOf(player)

    await server.app.realtime.revalidateSessions()

    expect((await tab.serverClosed).code).toBe(SESSION_ENDED)
  })

  it('keeps the socket of a live session', async () => {
    const tab = await connect(server, player)

    await server.app.realtime.revalidateSessions()

    expect(await tab.drain()).toEqual([])
    tab.client.close()
  })

  it('keeps a guest socket, which holds no session', async () => {
    const guest = await connect(server)

    await server.app.realtime.revalidateSessions()

    expect(await guest.drain()).toEqual([])
    guest.client.close()
  })
})

describe('realtime message rate', () => {
  it('refuses messages beyond the rate a socket may send', async () => {
    const tab = await connect(server, player)

    // In batches under the in-flight limit, so only the rate decides.
    for (let sent = 0; sent < MESSAGE_RATE_LIMIT; sent++) {
      tab.send({ type: 'unsubscribe_lobby' })
      if (sent % 5 === 4) expect(await tab.drain()).toEqual([])
    }
    tab.send({ type: 'unsubscribe_lobby' })
    const received = await tab.drain()

    expect(received).toEqual([
      expect.objectContaining({
        type: 'error',
        payload: { code: 'TOO_MANY_REQUESTS', message: 'Too many messages' },
      }),
    ])
    tab.client.close()
  })
})
