import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
  DiscordServerPreview,
} from '@domain/services/discord-invite-preview-provider.interface'
import { CheckDiscordInviteUseCase } from './check-discord-invite.use-case'

const PREVIEW: DiscordServerPreview = {
  name: 'VALORANT',
  iconUrl: 'https://cdn.discordapp.com/icons/1/abc.png?size=128',
  backdropUrl: 'https://cdn.discordapp.com/banners/1/def.png?size=480',
  memberCount: 2_946_792,
  onlineCount: 362_025,
  expiresAt: null,
  channel: { id: '1234', name: 'Squad call', kind: 'voice' },
}

describe('CheckDiscordInviteUseCase', () => {
  let provider: { fetch: ReturnType<typeof vi.fn<DiscordInvitePreviewProvider['fetch']>> }
  let useCase: CheckDiscordInviteUseCase

  const answers = (outcome: DiscordInvitePreviewOutcome) =>
    provider.fetch.mockResolvedValue(outcome)

  beforeEach(() => {
    provider = { fetch: vi.fn<DiscordInvitePreviewProvider['fetch']>() }
    useCase = new CheckDiscordInviteUseCase(provider)
  })

  it('asks Discord about the code and returns the server and call of an invite that never expires', async () => {
    answers({ kind: 'found', preview: PREVIEW })

    await expect(useCase.execute({ code: 'valorant' })).resolves.toEqual({
      status: 'valid',
      server: { name: 'VALORANT', iconUrl: PREVIEW.iconUrl, memberCount: 2_946_792 },
      call: { name: 'Squad call' },
      expires: false,
    })
    expect(provider.fetch).toHaveBeenCalledWith('valorant')
  })

  it('accepts an invite to a stage channel like one to a voice call', async () => {
    answers({
      kind: 'found',
      preview: { ...PREVIEW, channel: { id: '5678', name: 'Town hall', kind: 'stage' } },
    })

    await expect(useCase.execute({ code: 'valorant' })).resolves.toMatchObject({
      status: 'valid',
      call: { name: 'Town hall' },
    })
  })

  it.each([
    ['a text channel', { id: '9', name: 'general', kind: 'other' as const }],
    ['no channel', null],
  ])('returns an invite to %s as not_voice_call', async (_, channel) => {
    answers({ kind: 'found', preview: { ...PREVIEW, channel } })

    await expect(useCase.execute({ code: 'valorant' })).resolves.toEqual({
      status: 'not_voice_call',
    })
  })

  it('flags an invite that expires', async () => {
    answers({ kind: 'found', preview: { ...PREVIEW, expiresAt: '2026-11-01T12:00:00+00:00' } })

    await expect(useCase.execute({ code: 'valorant' })).resolves.toMatchObject({
      status: 'valid',
      expires: true,
    })
  })

  it('returns an invite Discord does not know as invalid', async () => {
    answers({ kind: 'invalid' })

    await expect(useCase.execute({ code: 'gone' })).resolves.toEqual({ status: 'invalid' })
  })

  it.each<DiscordInvitePreviewOutcome>([
    { kind: 'rate_limited' },
    { kind: 'rate_limited', retryAfterMs: 4_000 },
    { kind: 'unreachable' },
  ])('returns unknown when Discord could not be asked ($kind)', async (outcome) => {
    answers(outcome)

    await expect(useCase.execute({ code: 'valorant' })).resolves.toEqual({ status: 'unknown' })
  })
})
