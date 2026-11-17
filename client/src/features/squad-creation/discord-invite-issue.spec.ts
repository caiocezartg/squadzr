import { describe, expect, it } from 'vitest'
import { discordInviteIssue, isDiscordServerErrorCode } from './discord-invite-issue'
import type { DiscordInviteState } from './use-discord-invite-check'

const valid: DiscordInviteState = {
  status: 'valid',
  server: { name: 'Hub', iconUrl: null, memberCount: null },
  call: { name: 'Squad call' },
  expires: false,
}

describe('discordInviteIssue', () => {
  it.each<[DiscordInviteState, string]>([
    [{ status: 'invalid' }, 'INVALID_DISCORD_INVITE'],
    [{ status: 'not_voice_call' }, 'DISCORD_INVITE_NOT_VOICE_CALL'],
    [{ status: 'unknown' }, 'DISCORD_UNAVAILABLE'],
  ])('explains %j with %s', (invite, code) => {
    expect(discordInviteIssue(invite, null)?.code).toBe(code)
  })

  it('lets only an unreachable Discord be retried', () => {
    expect(discordInviteIssue({ status: 'unknown' }, null)?.retryable).toBe(true)
    expect(discordInviteIssue({ status: 'not_voice_call' }, null)?.retryable).toBe(false)
    expect(discordInviteIssue({ status: 'invalid' }, null)?.retryable).toBe(false)
  })

  it.each([valid, { status: 'idle' }, { status: 'checking' }] as DiscordInviteState[])(
    'has no issue for %j',
    (invite) => {
      expect(discordInviteIssue(invite, null)).toBeNull()
    }
  )

  it('shows the code the server answered with over what the check said', () => {
    expect(discordInviteIssue(valid, 'DISCORD_INVITE_NOT_VOICE_CALL')).toEqual({
      code: 'DISCORD_INVITE_NOT_VOICE_CALL',
      retryable: false,
    })
    expect(discordInviteIssue({ status: 'unknown' }, 'INVALID_DISCORD_INVITE')?.code).toBe(
      'INVALID_DISCORD_INVITE'
    )
  })
})

describe('isDiscordServerErrorCode', () => {
  it('knows the three codes that land on the field', () => {
    expect(isDiscordServerErrorCode('INVALID_DISCORD_INVITE')).toBe(true)
    expect(isDiscordServerErrorCode('DISCORD_INVITE_NOT_VOICE_CALL')).toBe(true)
    expect(isDiscordServerErrorCode('DISCORD_UNAVAILABLE')).toBe(true)
    expect(isDiscordServerErrorCode('INVALID_GAME')).toBe(false)
    expect(isDiscordServerErrorCode(undefined)).toBe(false)
  })
})
