import { describe, expect, it, vi } from 'vitest'
import {
  DiscordApiInvitePreviewProvider,
  type DiscordApiInvitePreviewOptions,
  type FetchLike,
} from './discord-api-invite-preview-provider'

/** The shape of a live answer (valorant, with_counts and with_expiration), reduced to the fields in use. */
const VALORANT = {
  code: 'valorant',
  expires_at: null,
  guild: {
    id: '679875946597056683',
    name: 'VALORANT',
    splash: 'e74961c48a671b99fd03ab49acdd8b35',
    banner: 'a_30b871864f463af9a2fe800b1c31b971',
    icon: '6dbf9035d5b43c6a669d59ab50a6a30d',
    features: ['ANIMATED_BANNER'],
  },
  channel: { id: '1234567890123456', name: 'Squad call', type: 2 },
  approximate_member_count: 2_946_792,
  approximate_presence_count: 362_025,
}

function providerAnswering(
  response: Response | Error,
  options: Omit<DiscordApiInvitePreviewOptions, 'fetchImpl'> = {}
) {
  const fetchImpl = vi.fn<FetchLike>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  )
  return { fetchImpl, provider: new DiscordApiInvitePreviewProvider({ fetchImpl, ...options }) }
}

/** A provider whose Discord answers each call with the next response; the sleeper never really waits. */
function providerAnsweringInOrder(
  responses: Response[],
  options: Omit<DiscordApiInvitePreviewOptions, 'fetchImpl' | 'sleep'> = {}
) {
  const queue = [...responses]
  const fetchImpl = vi.fn<FetchLike>(() => {
    const next = queue.shift()
    return next ? Promise.resolve(next) : Promise.reject(new Error('no answer left'))
  })
  const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve())
  return {
    fetchImpl,
    sleep,
    provider: new DiscordApiInvitePreviewProvider({ fetchImpl, sleep, ...options }),
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('DiscordApiInvitePreviewProvider', () => {
  it('asks the public invite endpoint for the counts and the expiration, with no credentials', async () => {
    const { provider, fetchImpl } = providerAnswering(json(VALORANT))

    await provider.fetch('valorant')

    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe(
      'https://discord.com/api/v10/invites/valorant?with_counts=true&with_expiration=true'
    )
    expect(new Headers(init?.headers).has('authorization')).toBe(false)
  })

  it('sends the bot token as an Authorization header when one is set', async () => {
    const { provider, fetchImpl } = providerAnswering(json(VALORANT), {
      botToken: 'fake-bot-token',
    })

    await provider.fetch('valorant')

    const [, init] = fetchImpl.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get('authorization')).toBe('Bot fake-bot-token')
  })

  it('sends no credentials when the token is empty', async () => {
    const { provider, fetchImpl } = providerAnswering(json(VALORANT), { botToken: '' })

    await provider.fetch('valorant')

    const [, init] = fetchImpl.mock.calls[0] ?? []
    expect(new Headers(init?.headers).has('authorization')).toBe(false)
  })

  it('maps a live answer to the server, its still banner and its counts', async () => {
    const { provider } = providerAnswering(json(VALORANT))

    await expect(provider.fetch('valorant')).resolves.toEqual({
      kind: 'found',
      preview: {
        name: 'VALORANT',
        iconUrl:
          'https://cdn.discordapp.com/icons/679875946597056683/6dbf9035d5b43c6a669d59ab50a6a30d.png?size=128',
        backdropUrl:
          'https://cdn.discordapp.com/banners/679875946597056683/a_30b871864f463af9a2fe800b1c31b971.png?size=480',
        memberCount: 2_946_792,
        onlineCount: 362_025,
        expiresAt: null,
        channel: { id: '1234567890123456', name: 'Squad call', kind: 'voice' },
      },
    })
  })

  it.each([
    [2, 'voice'],
    [13, 'stage'],
    [0, 'other'],
    [5, 'other'],
  ])('maps the channel type %i to %s', async (type, kind) => {
    const { provider } = providerAnswering(
      json({ ...VALORANT, channel: { id: '99', name: 'general', type } })
    )

    await expect(provider.fetch('valorant')).resolves.toMatchObject({
      kind: 'found',
      preview: { channel: { id: '99', name: 'general', kind } },
    })
  })

  it.each([
    ['missing', { ...VALORANT, channel: undefined }],
    ['null', { ...VALORANT, channel: null }],
    ['a string', { ...VALORANT, channel: 'general' }],
    ['without a type', { ...VALORANT, channel: { id: '99', name: 'general' } }],
    ['with an id that is no snowflake', { ...VALORANT, channel: { id: 'x', name: 'a', type: 2 } }],
    ['with an empty name', { ...VALORANT, channel: { id: '99', name: '', type: 2 } }],
    [
      'with a name over 100 characters',
      { ...VALORANT, channel: { id: '99', name: 'x'.repeat(101), type: 2 } },
    ],
  ])('reads a channel that is %s as none, never as unreachable', async (_, body) => {
    const { provider } = providerAnswering(json(body))

    await expect(provider.fetch('valorant')).resolves.toMatchObject({
      kind: 'found',
      preview: { name: 'VALORANT', channel: null },
    })
  })

  it('serves an animated icon as a GIF and falls back from the banner to the splash', async () => {
    const { provider } = providerAnswering(
      json({
        guild: { id: '1', name: 'Anim', icon: 'a_abc123', banner: null, splash: 'def456' },
      })
    )

    await expect(provider.fetch('anim')).resolves.toMatchObject({
      kind: 'found',
      preview: {
        iconUrl: 'https://cdn.discordapp.com/icons/1/a_abc123.gif?size=128',
        backdropUrl: 'https://cdn.discordapp.com/splashes/1/def456.png?size=480',
        memberCount: null,
        onlineCount: null,
        expiresAt: null,
      },
    })
  })

  it('carries the moment an expiring invite stops working', async () => {
    const { provider } = providerAnswering(
      json({ ...VALORANT, expires_at: '2026-11-01T12:00:00.000000+00:00' })
    )

    await expect(provider.fetch('valorant')).resolves.toMatchObject({
      kind: 'found',
      preview: { expiresAt: '2026-11-01T12:00:00.000000+00:00' },
    })
  })

  it('leaves the icon and backdrop out when the server has none', async () => {
    const { provider } = providerAnswering(json({ guild: { id: '1', name: 'Bare', icon: null } }))

    await expect(provider.fetch('bare')).resolves.toMatchObject({
      preview: { iconUrl: null, backdropUrl: null },
    })
  })

  it('reads an unknown or expired invite (404) as invalid', async () => {
    const { provider } = providerAnswering(json({ message: 'Unknown Invite', code: 10006 }, 404))

    await expect(provider.fetch('nope')).resolves.toEqual({ kind: 'invalid' })
  })

  it('reads an invite with no server behind it as invalid', async () => {
    const { provider } = providerAnswering(json({ code: 'dm', approximate_member_count: 3 }))

    await expect(provider.fetch('dm')).resolves.toEqual({ kind: 'invalid' })
  })

  describe('a 429', () => {
    it('waits out a retry_after of at most 2 seconds and asks once more', async () => {
      const { provider, fetchImpl, sleep } = providerAnsweringInOrder([
        json({ retry_after: 1.5 }, 429),
        json(VALORANT),
      ])

      await expect(provider.fetch('valorant')).resolves.toMatchObject({ kind: 'found' })

      expect(sleep.mock.calls).toEqual([[1_500]])
      expect(fetchImpl).toHaveBeenCalledTimes(2)
    })

    it('sends the bot token on the retried request too', async () => {
      const { provider, fetchImpl } = providerAnsweringInOrder(
        [json({ retry_after: 1 }, 429), json(VALORANT)],
        { botToken: 'fake-bot-token' }
      )

      await provider.fetch('valorant')

      expect(fetchImpl).toHaveBeenCalledTimes(2)
      for (const [, init] of fetchImpl.mock.calls) {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bot fake-bot-token')
      }
    })

    it.each(['abc', '-1', '1e3', '0x10', 'Infinity'])(
      'ignores a Retry-After header of %j',
      async (header) => {
        const { provider, sleep } = providerAnsweringInOrder([
          new Response('rate limited', { status: 429, headers: { 'Retry-After': header } }),
        ])

        await expect(provider.fetch('valorant')).resolves.toEqual({ kind: 'rate_limited' })

        expect(sleep).not.toHaveBeenCalled()
      }
    )

    it('waits for a retry_after of exactly 2 seconds', async () => {
      const { provider, sleep } = providerAnsweringInOrder([
        json({ retry_after: 2 }, 429),
        json(VALORANT),
      ])

      await provider.fetch('valorant')

      expect(sleep.mock.calls).toEqual([[2_000]])
    })

    it('reads the wait from the Retry-After header when the body has none', async () => {
      const { provider, sleep } = providerAnsweringInOrder([
        new Response('rate limited', { status: 429, headers: { 'Retry-After': '1' } }),
        json(VALORANT),
      ])

      await expect(provider.fetch('valorant')).resolves.toMatchObject({ kind: 'found' })

      expect(sleep.mock.calls).toEqual([[1_000]])
    })

    it('returns rate_limited at once for a retry_after over 2 seconds, without waiting', async () => {
      const { provider, fetchImpl, sleep } = providerAnsweringInOrder([
        json({ retry_after: 2.5 }, 429),
        json(VALORANT),
      ])

      await expect(provider.fetch('valorant')).resolves.toEqual({
        kind: 'rate_limited',
        retryAfterMs: 2_500,
      })

      expect(sleep).not.toHaveBeenCalled()
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('returns rate_limited, with no wait to carry, when Discord names none', async () => {
      const { provider, fetchImpl, sleep } = providerAnsweringInOrder([
        new Response('rate limited', { status: 429 }),
        json(VALORANT),
      ])

      await expect(provider.fetch('valorant')).resolves.toEqual({ kind: 'rate_limited' })

      expect(sleep).not.toHaveBeenCalled()
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('asks only once more: a second 429 is rate_limited with its own wait', async () => {
      const { provider, fetchImpl, sleep } = providerAnsweringInOrder([
        json({ retry_after: 1 }, 429),
        json({ retry_after: 1.2 }, 429),
        json(VALORANT),
      ])

      await expect(provider.fetch('valorant')).resolves.toEqual({
        kind: 'rate_limited',
        retryAfterMs: 1_200,
      })

      expect(sleep).toHaveBeenCalledTimes(1)
      expect(fetchImpl).toHaveBeenCalledTimes(2)
    })

    it('reads a failure on the second ask by its own status', async () => {
      const { provider } = providerAnsweringInOrder([
        json({ retry_after: 1 }, 429),
        json({ message: 'Unknown Invite' }, 404),
      ])

      await expect(provider.fetch('gone')).resolves.toEqual({ kind: 'invalid' })
    })
  })

  describe('logging', () => {
    const token = 'fake-bot-token'

    it.each([
      ['a long rate limit', [json({ retry_after: 30 }, 429)], 'rate_limited', 30_000],
      ['a 429 with no wait', [new Response('', { status: 429 })], 'rate_limited', null],
      ['a Discord error', [json({}, 503)], 'unreachable', null],
    ])(
      'warns about %s with the code and the wait, never the token',
      async (_, responses, outcome, retryAfterMs) => {
        const warn = vi.fn<(details: Record<string, unknown>, message: string) => void>()
        const { provider } = providerAnsweringInOrder(responses, {
          botToken: token,
          logger: { warn },
        })

        await provider.fetch('valorant')

        expect(warn.mock.calls).toEqual([
          [
            {
              inviteCode: 'valorant',
              outcome,
              retryAfterMs,
              status: outcome === 'unreachable' ? 503 : null,
            },
            expect.any(String),
          ],
        ])
        expect(JSON.stringify(warn.mock.calls)).not.toContain(token)
      }
    )

    it.each([401, 403])(
      'logs the status of a %i, so a rejected token shows apart from an outage, never the token',
      async (status) => {
        const warn = vi.fn<(details: Record<string, unknown>, message: string) => void>()
        const { provider } = providerAnswering(json({ message: 'Unauthorized' }, status), {
          botToken: token,
          logger: { warn },
        })

        await expect(provider.fetch('valorant')).resolves.toEqual({ kind: 'unreachable', status })

        expect(warn.mock.calls).toEqual([
          [
            { inviteCode: 'valorant', outcome: 'unreachable', retryAfterMs: null, status },
            expect.any(String),
          ],
        ])
        expect(JSON.stringify(warn.mock.calls)).not.toContain(token)
      }
    )

    it('warns about a network failure without leaking the token', async () => {
      const warn = vi.fn<(details: Record<string, unknown>, message: string) => void>()
      const { provider } = providerAnswering(new Error(`socket hang up ${token}`), {
        botToken: token,
        logger: { warn },
      })

      await expect(provider.fetch('valorant')).resolves.toEqual({ kind: 'unreachable' })

      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toMatchObject({ status: null })
      expect(JSON.stringify(warn.mock.calls)).not.toContain(token)
    })

    it('stays quiet about answers that do not block creating a Squad', async () => {
      const warn = vi.fn()
      const { provider } = providerAnswering(json(VALORANT), { logger: { warn } })
      await provider.fetch('valorant')
      const { provider: gone } = providerAnswering(json({}, 404), { logger: { warn } })
      await gone.fetch('gone')

      expect(warn).not.toHaveBeenCalled()
    })

    it('does not warn about a 429 that the retry resolved', async () => {
      const warn = vi.fn()
      const { provider } = providerAnsweringInOrder(
        [json({ retry_after: 1 }, 429), json(VALORANT)],
        {
          logger: { warn },
        }
      )

      await provider.fetch('valorant')

      expect(warn).not.toHaveBeenCalled()
    })
  })

  it.each([500, 503])('reads a %i as unreachable', async (status) => {
    const { provider } = providerAnswering(json({}, status))

    await expect(provider.fetch('valorant')).resolves.toEqual({ kind: 'unreachable', status })
  })

  it.each([
    ['a network failure', new Error('socket hang up')],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
    ['a body the contract refuses', json({ guild: { id: 'not-a-snowflake', name: 'x' } })],
    [
      'an image hash that could change a URL',
      json({ guild: { id: '1', name: 'x', icon: '../a' } }),
    ],
  ])('reads %s as unreachable', async (_, response) => {
    const { provider } = providerAnswering(response)

    await expect(provider.fetch('valorant')).resolves.toEqual({ kind: 'unreachable' })
  })

  it('gives up on a Discord that does not answer within the timeout', async () => {
    const fetchImpl = vi.fn<FetchLike>(
      (_, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })
    )
    const provider = new DiscordApiInvitePreviewProvider({ fetchImpl, timeoutMs: 20 })

    await expect(provider.fetch('slow')).resolves.toEqual({ kind: 'unreachable' })
  })
})
