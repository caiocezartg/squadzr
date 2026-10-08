import { describe, expect, it, vi } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { HealthController } from './health.controller'

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function fakeReply() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockResolvedValue(undefined),
  }
}

/** A request whose `SELECT 1` probe resolves or rejects as the test needs. */
function fakeRequest(probe: () => Promise<unknown>): FastifyRequest {
  return { server: { db: { execute: probe } } } as unknown as FastifyRequest
}

function asReply(reply: ReturnType<typeof fakeReply>): FastifyReply {
  return reply as unknown as FastifyReply
}

/** The payload every probe sends: its status, an ISO instant, process uptime and version. */
function expectedPayload(status: 'ok' | 'error') {
  return {
    status,
    timestamp: expect.stringMatching(ISO_TIMESTAMP),
    uptime: expect.any(Number),
    version: '0.1.0',
  }
}

describe('HealthController', () => {
  it('answers /health with status 200 and the ok payload', async () => {
    const reply = fakeReply()

    await new HealthController().check(
      fakeRequest(async () => undefined),
      asReply(reply)
    )

    expect(reply.status).toHaveBeenCalledWith(200)
    expect(reply.send).toHaveBeenCalledWith(expectedPayload('ok'))
  })

  it('answers /health/ready with 200 and the ok payload when SELECT 1 succeeds', async () => {
    const reply = fakeReply()
    const probe = vi.fn().mockResolvedValue({ rows: [] })

    await new HealthController().readiness(fakeRequest(probe), asReply(reply))

    expect(probe).toHaveBeenCalledOnce()
    expect(reply.status).toHaveBeenCalledWith(200)
    expect(reply.send).toHaveBeenCalledWith(expectedPayload('ok'))
  })

  it('answers /health/ready with 503 and the error payload when SELECT 1 fails', async () => {
    const reply = fakeReply()
    const failingProbe = async () => {
      throw new Error('connection refused')
    }

    await new HealthController().readiness(fakeRequest(failingProbe), asReply(reply))

    expect(reply.status).toHaveBeenCalledWith(503)
    expect(reply.send).toHaveBeenCalledWith(expectedPayload('error'))
  })
})
