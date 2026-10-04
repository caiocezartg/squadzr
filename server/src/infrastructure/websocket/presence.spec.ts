import type { WebSocket } from '@fastify/websocket'
import { expect, it, vi } from 'vitest'
import { FakeClock } from '@test/harness/clock'
import { Presence } from './presence'

it('retains new joins and returning sessions after a roster read starts, even at the same clock instant', () => {
  const clock = new FakeClock(new Date('2026-10-04T00:00:00Z'))
  const presence = new Presence(clock, vi.fn())
  const firstSocket = {} as WebSocket
  const secondSocket = {} as WebSocket
  presence.join('ROOM01', 'returning', firstSocket)
  presence.join('ROOM01', 'removed', firstSocket)
  const observed = presence.captureMembers('ROOM01')
  presence.leave('ROOM01', 'returning', firstSocket)
  presence.join('ROOM01', 'returning', secondSocket)
  presence.join('ROOM01', 'newcomer', secondSocket)

  presence.retainMembers('ROOM01', new Set(), observed)

  expect(presence.isOnline('ROOM01', 'returning')).toBe(true)
  expect(presence.isOnline('ROOM01', 'newcomer')).toBe(true)
  expect(presence.isOnline('ROOM01', 'removed')).toBe(false)
  // A later roster can still revoke these members when no newer join happened.
  presence.retainMembers('ROOM01', new Set(), presence.captureMembers('ROOM01'))
  expect(presence.isOnline('ROOM01', 'returning')).toBe(false)
  expect(presence.isOnline('ROOM01', 'newcomer')).toBe(false)
})
