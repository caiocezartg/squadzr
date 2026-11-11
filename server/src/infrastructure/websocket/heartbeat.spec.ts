import type { WebSocket } from '@fastify/websocket'
import { describe, expect, it, vi } from 'vitest'
import { FakeClock } from '@test/harness/clock'
import { Heartbeat } from './heartbeat'
import { Presence } from './presence'

function socket() {
  return { OPEN: 1, readyState: 1, ping: vi.fn(), terminate: vi.fn() } as unknown as WebSocket
}

describe('heartbeat and silent failure convergence', () => {
  it('pings after 20 seconds and keeps responsive connections alive', () => {
    const clock = new FakeClock(new Date())
    const expired = vi.fn()
    const heartbeat = new Heartbeat(clock, expired)
    const client = socket()
    heartbeat.add(client)
    clock.advance(19_999)
    heartbeat.sweep()
    expect(client.ping).not.toHaveBeenCalled()
    clock.advance(1)
    heartbeat.sweep()
    expect(client.ping).toHaveBeenCalledTimes(1)
    heartbeat.pong(client)
    clock.advance(20_000)
    heartbeat.sweep()
    expect(expired).not.toHaveBeenCalled()
    expect(client.ping).toHaveBeenCalledTimes(2)
  })

  it('terminates a silent session at 40 seconds and publishes offline at 50 seconds', () => {
    const clock = new FakeClock(new Date())
    const transition = vi.fn()
    const presence = new Presence(clock, transition)
    const client = socket()
    presence.join('ABC123', 'member', client)
    const expired = vi.fn(() => presence.leave('ABC123', 'member', client))
    const heartbeat = new Heartbeat(clock, expired)
    heartbeat.add(client)
    clock.advance(39_999)
    heartbeat.sweep()
    expect(expired).not.toHaveBeenCalled()
    clock.advance(1)
    heartbeat.sweep()
    expect(expired).toHaveBeenCalledTimes(1)
    expect(client.terminate).toHaveBeenCalledTimes(1)
    clock.advance(9_999)
    presence.sweep()
    expect(transition).not.toHaveBeenCalled()
    clock.advance(1)
    presence.sweep()
    expect(transition).toHaveBeenCalledWith('ABC123', 'member', false)
    heartbeat.sweep()
    expect(client.terminate).toHaveBeenCalledTimes(1)
  })

  it('forgets disconnected sessions and clears every connection on shutdown', () => {
    const clock = new FakeClock(new Date())
    const expired = vi.fn()
    const heartbeat = new Heartbeat(clock, expired)
    const first = socket()
    const second = socket()
    heartbeat.add(first)
    heartbeat.add(second)
    heartbeat.remove(first)
    heartbeat.clear()
    clock.advance(60_000)
    heartbeat.sweep()
    expect(expired).not.toHaveBeenCalled()
    expect(first.ping).not.toHaveBeenCalled()
    expect(second.ping).not.toHaveBeenCalled()
  })
})
