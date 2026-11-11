import { afterEach, describe, expect, it } from 'vitest'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// The API reference maps every route, schema and error code: a help while developing, a map for an
// attacker in production.

let server: TestServer | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

describe('API reference', () => {
  it('is served outside production', async () => {
    server = await buildTestServer()

    const reference = await server.app.inject({ method: 'GET', url: '/docs/' })
    const document = await server.app.inject({ method: 'GET', url: '/docs/openapi.json' })

    expect(reference.statusCode).toBe(200)
    expect(document.statusCode).toBe(200)
  })

  it('is not served in production', async () => {
    server = await buildTestServer({ NODE_ENV: 'production' })

    const reference = await server.app.inject({ method: 'GET', url: '/docs/' })
    const document = await server.app.inject({ method: 'GET', url: '/docs/openapi.json' })

    expect(reference.statusCode).toBe(404)
    expect(document.statusCode).toBe(404)
  })
})
