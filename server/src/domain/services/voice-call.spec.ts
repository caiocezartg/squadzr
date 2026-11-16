import { describe, expect, it } from 'vitest'
import type {
  DiscordInviteChannel,
  DiscordServerPreview,
} from './discord-invite-preview-provider.interface'
import { isVoiceCall, voiceCallOf } from './voice-call'

const channel = (kind: DiscordInviteChannel['kind']): DiscordInviteChannel => ({
  id: '1234',
  name: 'Squad call',
  kind,
})

const previewWith = (channel: DiscordInviteChannel | null): DiscordServerPreview => ({
  name: 'Server',
  iconUrl: null,
  backdropUrl: null,
  memberCount: null,
  onlineCount: null,
  expiresAt: null,
  channel,
})

describe('isVoiceCall', () => {
  it.each(['voice', 'stage'] as const)('counts a %s channel as a Voice Call', (kind) => {
    expect(isVoiceCall(channel(kind))).toBe(true)
  })

  it('refuses any other channel and a missing one', () => {
    expect(isVoiceCall(channel('other'))).toBe(false)
    expect(isVoiceCall(null)).toBe(false)
  })
})

describe('voiceCallOf', () => {
  it.each(['voice', 'stage'] as const)('names the call behind a %s invite', (kind) => {
    expect(voiceCallOf(previewWith(channel(kind)))).toEqual({ id: '1234', name: 'Squad call' })
  })

  it.each([channel('other'), null])('finds no call behind %j', (target) => {
    expect(voiceCallOf(previewWith(target))).toBeNull()
  })
})
