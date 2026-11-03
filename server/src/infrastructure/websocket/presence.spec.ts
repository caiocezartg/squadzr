import type { WebSocket } from '@fastify/websocket'
import { describe, expect, it, vi } from 'vitest'
import { FakeClock } from '@test/harness/clock'
import { Presence, RECONNECT_GRACE_MS } from './presence'

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

describe('offline time', () => {
  const CLOSED_AT = new Date('2026-10-04T00:00:00Z')

  function offlineMember() {
    const clock = new FakeClock(CLOSED_AT)
    const transition = vi.fn()
    const presence = new Presence(clock, transition)
    const socket = {} as WebSocket
    presence.join('ROOM01', 'member', socket)
    presence.leave('ROOM01', 'member', socket)
    return { clock, transition, presence, socket }
  }

  it('is unknown while the member is online and during the grace', () => {
    const { clock, presence } = offlineMember()

    expect(presence.offlineSince('ROOM01', 'member')).toBeNull()
    clock.advance(RECONNECT_GRACE_MS - 1)
    presence.sweep()

    expect(presence.isOnline('ROOM01', 'member')).toBe(true)
    expect(presence.offlineSince('ROOM01', 'member')).toBeNull()
  })

  it('is the time the last session closed, set before the offline transition fires', () => {
    const { clock, transition, presence } = offlineMember()
    let seen: Date | null = null
    transition.mockImplementation(() => {
      seen = presence.offlineSince('ROOM01', 'member')
    })

    clock.advance(RECONNECT_GRACE_MS + 5_000)
    presence.sweep()

    expect(presence.isOnline('ROOM01', 'member')).toBe(false)
    expect(presence.offlineSince('ROOM01', 'member')).toEqual(CLOSED_AT)
    expect(seen).toEqual(CLOSED_AT)
    expect(transition).toHaveBeenCalledTimes(1)
    expect(transition).toHaveBeenCalledWith('ROOM01', 'member', false)
  })

  it('follows the last of several sessions to close', () => {
    const clock = new FakeClock(CLOSED_AT)
    const presence = new Presence(clock, vi.fn())
    const first = {} as WebSocket
    const second = {} as WebSocket
    presence.join('ROOM01', 'member', first)
    presence.join('ROOM01', 'member', second)
    presence.leave('ROOM01', 'member', first)
    clock.advance(4_000)
    presence.leave('ROOM01', 'member', second)

    clock.advance(RECONNECT_GRACE_MS)
    presence.sweep()

    expect(presence.offlineSince('ROOM01', 'member')).toEqual(new Date(CLOSED_AT.getTime() + 4_000))
  })

  it('clears when the member comes back online', () => {
    const { clock, presence } = offlineMember()
    clock.advance(RECONNECT_GRACE_MS)
    presence.sweep()

    presence.join('ROOM01', 'member', {} as WebSocket)

    expect(presence.offlineSince('ROOM01', 'member')).toBeNull()
  })

  it('is removed with the Membership, and a member that is still on the roster keeps it', () => {
    const { clock, presence } = offlineMember()
    const otherSocket = {} as WebSocket
    presence.join('ROOM01', 'other', otherSocket)
    presence.leave('ROOM01', 'other', otherSocket)
    clock.advance(RECONNECT_GRACE_MS)
    presence.sweep()

    presence.retainMembers('ROOM01', new Set(['member']), presence.captureMembers('ROOM01'))

    expect(presence.offlineSince('ROOM01', 'member')).toEqual(CLOSED_AT)
    presence.retainMembers('ROOM01', new Set(), presence.captureMembers('ROOM01'))
    expect(presence.offlineSince('ROOM01', 'member')).toBeNull()
  })

  it('is removed when the Squad is deleted or Presence is cleared', () => {
    const { clock, presence } = offlineMember()
    clock.advance(RECONNECT_GRACE_MS)
    presence.sweep()

    presence.deleteRoom('ROOM01')
    expect(presence.offlineSince('ROOM01', 'member')).toBeNull()

    const second = offlineMember()
    second.clock.advance(RECONNECT_GRACE_MS)
    second.presence.sweep()
    second.presence.clear()
    expect(second.presence.offlineSince('ROOM01', 'member')).toBeNull()
  })

  it('is unknown for a member never seen', () => {
    const presence = new Presence(new FakeClock(CLOSED_AT), vi.fn())

    expect(presence.offlineSince('ROOM01', 'stranger')).toBeNull()
  })
})
