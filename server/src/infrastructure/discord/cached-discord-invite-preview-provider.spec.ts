import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
} from '@domain/services/discord-invite-preview-provider.interface'
import { createMockClock } from '@test/mocks'
import { CachedDiscordInvitePreviewProvider } from './cached-discord-invite-preview-provider'

const SECOND = 1_000
const MINUTE = 60_000
const FOUND: DiscordInvitePreviewOutcome = {
  kind: 'found',
  preview: {
    name: 'VALORANT',
    iconUrl: null,
    backdropUrl: null,
    memberCount: 1,
    onlineCount: 1,
    expiresAt: null,
    channel: null,
  },
}

describe('CachedDiscordInvitePreviewProvider', () => {
  let inner: { fetch: ReturnType<typeof vi.fn<DiscordInvitePreviewProvider['fetch']>> }
  let clock: ReturnType<typeof createMockClock>
  let cached: CachedDiscordInvitePreviewProvider

  const advance = (ms: number) => clock.set(new Date(clock.now().getTime() + ms))

  beforeEach(() => {
    inner = { fetch: vi.fn<DiscordInvitePreviewProvider['fetch']>().mockResolvedValue(FOUND) }
    clock = createMockClock()
    cached = new CachedDiscordInvitePreviewProvider(inner, clock)
  })

  it('asks Discord once for an invite within ten minutes', async () => {
    await expect(cached.fetch('valorant')).resolves.toEqual(FOUND)
    advance(9 * MINUTE + 59_000)
    await expect(cached.fetch('valorant')).resolves.toEqual(FOUND)

    expect(inner.fetch).toHaveBeenCalledTimes(1)
  })

  it('asks Discord again once ten minutes have passed', async () => {
    await cached.fetch('valorant')
    advance(10 * MINUTE)
    await cached.fetch('valorant')

    expect(inner.fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps each invite code apart', async () => {
    await cached.fetch('valorant')
    await cached.fetch('minecraft')

    expect(inner.fetch).toHaveBeenCalledTimes(2)
  })

  it('asks again after a minute when Discord does not know the invite', async () => {
    inner.fetch.mockResolvedValueOnce({ kind: 'invalid' })

    await expect(cached.fetch('valorant')).resolves.toEqual({ kind: 'invalid' })
    advance(59 * SECOND)
    await cached.fetch('valorant')
    expect(inner.fetch).toHaveBeenCalledTimes(1)

    advance(SECOND)
    await expect(cached.fetch('valorant')).resolves.toEqual(FOUND)
    expect(inner.fetch).toHaveBeenCalledTimes(2)
  })

  it('asks again after ten seconds when Discord was unreachable', async () => {
    inner.fetch.mockResolvedValueOnce({ kind: 'unreachable' })

    await expect(cached.fetch('valorant')).resolves.toEqual({ kind: 'unreachable' })
    advance(9 * SECOND)
    await cached.fetch('valorant')
    expect(inner.fetch).toHaveBeenCalledTimes(1)

    advance(SECOND)
    await expect(cached.fetch('valorant')).resolves.toEqual(FOUND)
    expect(inner.fetch).toHaveBeenCalledTimes(2)
  })

  it('reads a rejection as unreachable and asks again after ten seconds', async () => {
    inner.fetch.mockRejectedValueOnce(new Error('boom'))

    await expect(cached.fetch('valorant')).resolves.toEqual({ kind: 'unreachable' })
    advance(9 * SECOND)
    await expect(cached.fetch('valorant')).resolves.toEqual({ kind: 'unreachable' })
    expect(inner.fetch).toHaveBeenCalledTimes(1)

    advance(SECOND)
    await expect(cached.fetch('valorant')).resolves.toEqual(FOUND)
    expect(inner.fetch).toHaveBeenCalledTimes(2)
  })

  describe.each<[string, DiscordInvitePreviewOutcome, number]>([
    ['the wait Discord asked for', { kind: 'rate_limited', retryAfterMs: 4_000 }, 4 * SECOND],
    ['ten seconds at most', { kind: 'rate_limited', retryAfterMs: 60_000 }, 10 * SECOND],
    ['ten seconds when Discord names no wait', { kind: 'rate_limited' }, 10 * SECOND],
  ])('a rate-limited answer is kept for %s', (_, outcome, keptMs) => {
    it('serves the answer until then and asks again at the end', async () => {
      inner.fetch.mockResolvedValueOnce(outcome)

      await expect(cached.fetch('busy')).resolves.toEqual(outcome)
      advance(keptMs - 1)
      await expect(cached.fetch('busy')).resolves.toEqual(outcome)
      expect(inner.fetch).toHaveBeenCalledTimes(1)

      advance(1)
      await expect(cached.fetch('busy')).resolves.toEqual(FOUND)
      expect(inner.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('shares one request between callers that arrive while it is in flight', async () => {
    let resolve!: (outcome: DiscordInvitePreviewOutcome) => void
    inner.fetch.mockReturnValue(new Promise((done) => (resolve = done)))

    const first = cached.fetch('valorant')
    const second = cached.fetch('valorant')
    resolve(FOUND)

    await expect(Promise.all([first, second])).resolves.toEqual([FOUND, FOUND])
    expect(inner.fetch).toHaveBeenCalledTimes(1)
  })

  it('holds at most maxEntries codes, dropping the oldest', async () => {
    cached = new CachedDiscordInvitePreviewProvider(inner, clock, { maxEntries: 2 })

    await cached.fetch('one')
    await cached.fetch('two')
    await cached.fetch('three')
    inner.fetch.mockClear()

    await cached.fetch('three')
    await cached.fetch('two')
    expect(inner.fetch).not.toHaveBeenCalled()

    await cached.fetch('one')
    expect(inner.fetch).toHaveBeenCalledTimes(1)
  })
})
