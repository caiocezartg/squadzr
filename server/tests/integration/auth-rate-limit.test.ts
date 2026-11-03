import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { signIn, type TestUser } from '@test/harness/auth'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// Better Auth limits its own routes per client address in production. The address is the one the trusted
// proxy saw, so a client cannot dodge the sign-in limit by writing a new x-forwarded-for each time; and the
// session read is not limited, because the Next server reads every visitor's session from one address.

const EDGE_PROXY = '10.0.0.2'
const VISITOR = '203.0.113.9'

let server: TestServer
let player: TestUser

beforeEach(async () => {
  server = await buildTestServer({ NODE_ENV: 'production' })
  player = await signIn(server, 'Player')
})

afterEach(async () => {
  await server.close()
})

function startSignIn(spoofedAddress: string) {
  return server.app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/social',
    remoteAddress: EDGE_PROXY,
    headers: { 'x-forwarded-for': `${spoofedAddress}, ${VISITOR}` },
    payload: { provider: 'discord', callbackURL: 'http://localhost:5173/squads' },
  })
}

describe('Better Auth rate limit', () => {
  it('limits sign-in by the address the proxy saw, whatever the client wrote', async () => {
    const statuses: number[] = []
    for (let attempt = 0; attempt < 4; attempt++) {
      statuses.push((await startSignIn(`198.51.100.${attempt}`)).statusCode)
    }

    expect(statuses.slice(0, 3)).not.toContain(429)
    expect(statuses[3]).toBe(429)
  })

  it('never limits the session read the Next server makes for every visitor', async () => {
    const statuses = new Set<number>()
    for (let read = 0; read < 120; read++) {
      const response = await server.app.inject({
        method: 'GET',
        url: '/api/auth/get-session',
        remoteAddress: EDGE_PROXY,
        headers: { ...player.headers, 'x-forwarded-for': VISITOR },
      })
      statuses.add(response.statusCode)
    }

    expect([...statuses]).toEqual([200])
  })
})
