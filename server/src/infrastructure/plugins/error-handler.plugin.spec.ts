import Fastify, { type FastifyInstance } from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import errorHandlerPlugin from './error-handler.plugin'

const SECRET_INVITE = 'https://discord.gg/review-secret'
const SESSION_TOKEN = 'review-session'

type LogEntry = Record<string, unknown>

let app: FastifyInstance

/** Builds an app with the real error handler and collects what it logs at warn and above. */
async function buildApp(): Promise<{ app: FastifyInstance; logs: LogEntry[]; raw: () => string }> {
  const lines: string[] = []
  app = Fastify({
    logger: { level: 'warn', stream: { write: (line: string) => lines.push(line) } },
  })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(errorHandlerPlugin)

  app.get('/invalid', {
    schema: { response: { 200: z.object({ room: z.object({ discordLink: z.url() }) }) } },
    handler: () => ({ room: { discordLink: 42, invite: SECRET_INVITE } }),
  })
  app.get('/boom', () => {
    throw new Error('database exploded')
  })
  app.get('/checked', {
    schema: { querystring: z.object({ limit: z.coerce.number().int().min(1) }) },
    handler: () => ({ ok: true }),
  })

  return {
    app,
    get logs() {
      return lines.map((line) => JSON.parse(line) as LogEntry)
    },
    raw: () => lines.join('\n'),
  }
}

afterEach(async () => {
  await app?.close()
})

describe('response contract violation', () => {
  it('answers with the typed 500 body and logs issue paths and codes only', async () => {
    const server = await buildApp()

    const response = await server.app.inject({
      method: 'GET',
      url: `/invalid?token=${SESSION_TOKEN}`,
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    })
    expect(server.logs).toEqual([
      expect.objectContaining({
        msg: 'Response does not match its contract',
        code: 'RESPONSE_CONTRACT_VIOLATION',
        method: 'GET',
        path: '/invalid',
        statusCode: 500,
        issues: [{ path: 'room.discordLink', code: 'invalid_type' }],
      }),
    ])
  })

  it('keeps the query string, the response body and the error object out of the log', async () => {
    const server = await buildApp()

    await server.app.inject({ method: 'GET', url: `/invalid?token=${SESSION_TOKEN}` })

    expect(server.raw()).not.toContain(SESSION_TOKEN)
    expect(server.raw()).not.toContain('token=')
    expect(server.raw()).not.toContain(SECRET_INVITE)
    expect(server.logs[0]).not.toHaveProperty('err')
    expect(server.logs[0]).not.toHaveProperty('url')
  })
})

describe('other errors', () => {
  it('logs an unhandled error with the request path but without its query string', async () => {
    const server = await buildApp()

    const response = await server.app.inject({ method: 'GET', url: `/boom?token=${SESSION_TOKEN}` })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    })
    expect(server.logs.at(-1)).toMatchObject({ method: 'GET', path: '/boom', statusCode: 500 })
    expect(server.raw()).toContain('database exploded')
    expect(server.raw()).not.toContain(SESSION_TOKEN)
  })

  it('logs a request validation error without the query string', async () => {
    const server = await buildApp()

    const response = await server.app.inject({
      method: 'GET',
      url: `/checked?limit=${SESSION_TOKEN}`,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'VALIDATION_ERROR' })
    expect(server.logs.at(-1)).toMatchObject({ method: 'GET', path: '/checked', statusCode: 400 })
    expect(server.raw()).not.toContain(SESSION_TOKEN)
  })
})
