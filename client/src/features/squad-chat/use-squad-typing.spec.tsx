import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT } from '@squadzr/schemas'
import type { RealtimeEventSubscribe } from '@/lib/ws-client'
import { withEnglishIntl } from '@/test/intl'
import { signInAsFakeUser } from '@/test/stubs'
import { useSquadTyping, type TypingMember } from './use-squad-typing'

const CODE = 'ABC123'
const ANA: TypingMember = { id: 'ana', name: 'Ana' }
const BIA: TypingMember = { id: 'bia', name: 'Bia' }
const MEMBERS = [ANA, BIA, { id: 'me', name: 'Caio' }]

/** The Lobby's channel as typing sees it: the socket's event registration, driven by the test. */
function createLiveEvents() {
  const handlers = new Map<string, Set<(payload: unknown) => void>>()
  const on: RealtimeEventSubscribe = (type, handler) => {
    const registered = handler as (payload: unknown) => void
    const set = handlers.get(type) ?? new Set()
    set.add(registered)
    handlers.set(type, set)
    return () => {
      set.delete(registered)
    }
  }
  function emit(type: string, payload: unknown): void {
    act(() => {
      for (const handler of handlers.get(type) ?? []) handler(payload)
    })
  }
  return { on, emit }
}

interface Props {
  readonly isReady: boolean
  readonly enabled: boolean
  readonly membershipRevoked: boolean
}

function renderTyping(initial: Partial<Props> = {}) {
  const live = createLiveEvents()
  const view = renderHook(
    (props: Props) =>
      useSquadTyping(
        CODE,
        { membershipRevoked: props.membershipRevoked, on: live.on },
        { enabled: props.enabled, isReady: props.isReady, members: MEMBERS }
      ),
    {
      wrapper: withEnglishIntl(),
      initialProps: { isReady: false, enabled: true, membershipRevoked: false, ...initial },
    }
  )
  const typing = (playerId: string, roomCode = CODE) =>
    live.emit('chat_typing', { roomCode, playerId })
  const message = (authorId: string, roomCode = CODE) =>
    live.emit('chat_message', { message: { roomCode, author: { id: authorId } } })
  return { ...view, live, typing, message }
}

function elapse(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  signInAsFakeUser({ id: 'me', name: 'Caio' })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSquadTyping', () => {
  it('shows a member as typing, by id and by name, in the order they started', () => {
    const { result, typing } = renderTyping()

    typing('bia')
    typing('ana')

    expect([...result.current.typingIds]).toEqual(['bia', 'ana'])
    expect(result.current.typers).toEqual([BIA, ANA])
  })

  it('shows nobody before any signal', () => {
    const { result } = renderTyping()

    expect(result.current.typingIds.size).toBe(0)
    expect(result.current.typers).toEqual([])
  })

  it('stops showing a member once the TTL passes since the last signal', () => {
    const { result, typing } = renderTyping()

    typing('ana')
    elapse(CHAT.TYPING_TTL_MS - 1)
    expect(result.current.typingIds.has('ana')).toBe(true)

    elapse(1)
    expect(result.current.typingIds.has('ana')).toBe(false)
  })

  it('renews the TTL on every new signal', () => {
    const { result, typing } = renderTyping()

    typing('ana')
    elapse(3_000)
    typing('ana')
    elapse(3_000)

    expect(result.current.typingIds.has('ana')).toBe(true)
    elapse(1_000)
    expect(result.current.typingIds.has('ana')).toBe(false)
  })

  it('expires each member on their own', () => {
    const { result, typing } = renderTyping()

    typing('ana')
    elapse(2_000)
    typing('bia')
    elapse(2_000)

    expect([...result.current.typingIds]).toEqual(['bia'])
  })

  it('clears a member at once when their message arrives, and only theirs', () => {
    const { result, typing, message } = renderTyping()
    typing('ana')
    typing('bia')

    message('ana')

    expect([...result.current.typingIds]).toEqual(['bia'])
  })

  it('does not let a stale timer clear a member who started typing again after their message', () => {
    const { result, typing, message } = renderTyping()
    typing('ana')
    elapse(3_000)
    message('ana')
    typing('ana')

    elapse(2_000)

    expect(result.current.typingIds.has('ana')).toBe(true)
  })

  it('ignores the viewer, even if the server echoed their own signal', () => {
    const { result, typing } = renderTyping()

    typing('me')

    expect(result.current.typingIds.size).toBe(0)
  })

  it('ignores the events of another Squad', () => {
    const { result, typing, message } = renderTyping()
    typing('ana')

    typing('bia', 'ZZZ999')
    message('ana', 'ZZZ999')

    expect([...result.current.typingIds]).toEqual(['ana'])
  })

  it('names nobody for a typist outside the members it was given, but still marks them', () => {
    const { result, typing } = renderTyping()

    typing('ghost')

    expect(result.current.typingIds.has('ghost')).toBe(true)
    expect(result.current.typers).toEqual([])
  })

  it('shows nothing while the Squad is Ready, and ignores signals meanwhile', () => {
    const { result, typing, rerender } = renderTyping()
    typing('ana')

    rerender({ isReady: true, enabled: true, membershipRevoked: false })
    expect(result.current.typingIds.size).toBe(0)
    typing('bia')
    expect(result.current.typingIds.size).toBe(0)
  })

  it('forgets what it held when the Squad turns Ready', () => {
    const { result, typing, rerender } = renderTyping()
    typing('ana')
    rerender({ isReady: true, enabled: true, membershipRevoked: false })

    rerender({ isReady: false, enabled: true, membershipRevoked: false })

    expect(result.current.typingIds.size).toBe(0)
  })

  it('shows nothing when the viewer is not a member or the Membership was revoked', () => {
    const outsider = renderTyping({ enabled: false })
    outsider.typing('ana')
    expect(outsider.result.current.typingIds.size).toBe(0)

    const revoked = renderTyping()
    revoked.typing('ana')
    revoked.rerender({ isReady: false, enabled: true, membershipRevoked: true })
    expect(revoked.result.current.typingIds.size).toBe(0)
  })

  it('registers nothing on the socket while it has nothing to show', () => {
    const live = createLiveEvents()
    const on = vi.fn(live.on)

    renderHook(
      () =>
        useSquadTyping(CODE, { membershipRevoked: false, on }, { enabled: true, isReady: true }),
      { wrapper: withEnglishIntl() }
    )

    expect(on).not.toHaveBeenCalled()
  })

  it('leaves no timer behind when it unmounts', () => {
    const { typing, unmount } = renderTyping()
    typing('ana')

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
