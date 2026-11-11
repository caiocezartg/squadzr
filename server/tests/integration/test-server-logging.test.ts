import { afterEach, expect, it, vi } from 'vitest'
import { requestLogSerializers } from '@/app'
import { createLogCapture } from '@test/harness/logging'
import { connect } from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

let server: TestServer | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
  vi.restoreAllMocks()
})

// Quiet test servers never serialize request logs, so this test reads them at info
// level. The capture stream keeps the output silent while the production serializer runs.
it('runs HTTP and injectWS requests through the production request serializer without throwing', async () => {
  const serialize = vi.spyOn(requestLogSerializers, 'req')
  const capture = createLogCapture('info')
  server = await buildTestServer({}, { logger: capture.logger })

  const response = await server.app.inject({ method: 'GET', url: '/health?probe=1' })
  const session = await connect(server)
  session.client.terminate()
  await session.serverClosed

  expect(response.statusCode).toBe(200)
  expect(session.protocol.type).toBe('protocol')
  expect(serialize).toHaveBeenCalled()
  const incoming = capture.lines
    .map((line) => JSON.parse(line) as { msg?: string; req?: { url?: string } })
    .filter((line) => line.msg === 'incoming request')
  // The production serializer keeps only the path, for the HTTP request and the upgrade alike.
  expect(incoming.map((line) => line.req?.url)).toEqual(['/health', '/ws'])
})

// The edge proxy appends the address it saw to x-forwarded-for; anything to its left came from the
// client and could be anything. Only the trusted hops are believed, so a client cannot pose as another.
it('logs the address the trusted proxy saw, not one the client wrote in x-forwarded-for', async () => {
  const capture = createLogCapture('info')
  server = await buildTestServer({}, { logger: capture.logger })

  await server.app.inject({
    method: 'GET',
    url: '/health',
    remoteAddress: '10.0.0.2',
    headers: { 'x-forwarded-for': '198.51.100.66, 203.0.113.9' },
  })

  const incoming = capture.lines
    .map((line) => JSON.parse(line) as { msg?: string; req?: { remoteAddress?: string } })
    .filter((line) => line.msg === 'incoming request')
  expect(incoming.map((line) => line.req?.remoteAddress)).toEqual(['203.0.113.9'])
})
