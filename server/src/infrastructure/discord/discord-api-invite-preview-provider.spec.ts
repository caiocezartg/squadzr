import { describe, expect, it, vi } from 'vitest'
import {
  DiscordApiInvitePreviewProvider,
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
  approximate_member_count: 2_946_792,
  approximate_presence_count: 362_025,
}

function providerAnswering(response: Response | Error) {
  const fetchImpl = vi.fn<FetchLike>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  )
  return { fetchImpl, provider: new DiscordApiInvitePreviewProvider({ fetchImpl }) }
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
      },
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

  it('reads a 429 as rate limited', async () => {
    const { provider } = providerAnswering(json({ retry_after: 2 }, 429))

    await expect(provider.fetch('valorant')).resolves.toEqual({ kind: 'rate_limited' })
  })

  it.each([500, 503])('reads a %i as unreachable', async (status) => {
    const { provider } = providerAnswering(json({}, status))

    await expect(provider.fetch('valorant')).resolves.toEqual({ kind: 'unreachable' })
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
