import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
} from '@domain/services/discord-invite-preview-provider.interface'
import { createMockClock } from '@test/mocks'
import { CachedDiscordInvitePreviewProvider } from './cached-discord-invite-preview-provider'

const MINUTE = 60_000
const FOUND: DiscordInvitePreviewOutcome = {
  kind: 'found',
  preview: {
    name: 'VALORANT',
    iconUrl: null,
    backdropUrl: null,
    memberCount: 1,
    onlineCount: 1,
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

  it.each<DiscordInvitePreviewOutcome>([{ kind: 'invalid' }, { kind: 'rate_limited' }])(
    'remembers a negative answer ($kind) for ten minutes too',
    async (outcome) => {
      inner.fetch.mockResolvedValue(outcome)

      await cached.fetch('gone')
      advance(5 * MINUTE)
      await expect(cached.fetch('gone')).resolves.toEqual(outcome)

      expect(inner.fetch).toHaveBeenCalledTimes(1)
    }
  )

  it('asks again after a minute when Discord was unreachable', async () => {
    inner.fetch.mockResolvedValueOnce({ kind: 'unreachable' })

    await cached.fetch('valorant')
    advance(59_000)
    await cached.fetch('valorant')
    expect(inner.fetch).toHaveBeenCalledTimes(1)

    advance(1_000)
    await expect(cached.fetch('valorant')).resolves.toEqual(FOUND)
    expect(inner.fetch).toHaveBeenCalledTimes(2)
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
