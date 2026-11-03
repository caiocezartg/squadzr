import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { signIn, type TestUser } from '@test/harness/auth'
import { connect } from '@test/harness/realtime'
import { createRoom, findRoomRow, get, insertGame } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// A browser attaches the session cookie to a request another site starts, so a
// change of state must come from the app's own origin. A text/plain form post
// needs no CORS preflight: only the Origin header tells it apart.

const APP_ORIGIN = 'http://localhost:5173'
const FOREIGN_ORIGIN = 'https://evil.example'

let server: TestServer
let host: TestUser
let gameId: string

beforeEach(async () => {
  server = await buildTestServer()
  host = await signIn(server, 'Host')
  gameId = (await insertGame(server)).id
})

afterEach(async () => {
  await server.close()
})

/** The request a cross-site `<form method="post" enctype="text/plain">` makes for a signed-in visitor: a simple request, sent without a CORS preflight. */
function formPost(user: TestUser, url: string, origin: string) {
  return server.app.inject({
    method: 'POST',
    url,
    headers: {
      ...user.headers,
      origin,
      'content-type': 'text/plain',
    },
    payload: 'x=1',
  })
}

describe('cross-site requests', () => {
  it('refuses a cross-site form post that would delete the host’s Squad', async () => {
    const room = await createRoom(server, host, { gameId })

    const response = await formPost(host, `/api/rooms/${room.code}/leave`, FOREIGN_ORIGIN)

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: 'FORBIDDEN_ORIGIN',
      message: expect.any(String),
    })
    expect(await findRoomRow(server, room.id)).toBeDefined()
  })

  it('refuses a cross-site form post that would make a visitor join a Squad', async () => {
    const room = await createRoom(server, host, { gameId })
    const visitor = await signIn(server, 'Visitor')

    const response = await formPost(visitor, `/api/rooms/${room.code}/join`, FOREIGN_ORIGIN)

    expect(response.statusCode).toBe(403)
    const lobby = await get(server, `/api/rooms/${room.code}`, visitor)
    expect(lobby.json<{ players?: unknown }>().players).toBeUndefined()
  })

  it('refuses a cross-site delete of a notification', async () => {
    const response = await server.app.inject({
      method: 'DELETE',
      url: '/api/notifications/00000000-0000-4000-8000-000000000000',
      headers: { ...host.headers, origin: FOREIGN_ORIGIN },
    })

    expect(response.statusCode).toBe(403)
  })

  it('accepts a change of state from the app’s own origin', async () => {
    const room = await createRoom(server, host, { gameId })
    const visitor = await signIn(server, 'Visitor')

    const response = await formPost(visitor, `/api/rooms/${room.code}/join`, APP_ORIGIN)

    expect(response.statusCode).toBe(200)
  })

  it('accepts a request without an Origin, as a non-browser client sends it', async () => {
    const room = await createRoom(server, host, { gameId })
    const visitor = await signIn(server, 'Visitor')

    const response = await server.app.inject({
      method: 'POST',
      url: `/api/rooms/${room.code}/join`,
      headers: visitor.headers,
    })

    expect(response.statusCode).toBe(200)
  })

  it('still serves a cross-site read, which CORS keeps the other site from reading', async () => {
    const response = await server.app.inject({
      method: 'GET',
      url: '/api/rooms',
      headers: { origin: FOREIGN_ORIGIN },
    })

    expect(response.statusCode).toBe(200)
  })

  it('refuses a WebSocket opened by another site', async () => {
    await expect(
      connect(server, host, { ...host.headers, origin: FOREIGN_ORIGIN })
    ).rejects.toThrow()
  })

  it('accepts a WebSocket opened by the app', async () => {
    const session = await connect(server, host, { ...host.headers, origin: APP_ORIGIN })

    expect(session.protocol.type).toBe('protocol')
    session.client.close()
  })
})
