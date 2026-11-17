import type { DiscordInviteState } from './use-discord-invite-check'

/** The server codes that land on the invite field, each with its own message under `errors.*`. */
export const DISCORD_SERVER_ERROR_CODES = [
  'INVALID_DISCORD_INVITE',
  'DISCORD_INVITE_NOT_VOICE_CALL',
  'DISCORD_UNAVAILABLE',
] as const

export type DiscordServerErrorCode = (typeof DISCORD_SERVER_ERROR_CODES)[number]

/** Whether an error code from the server is one of the three that land on the invite field. */
export function isDiscordServerErrorCode(code: unknown): code is DiscordServerErrorCode {
  return DISCORD_SERVER_ERROR_CODES.some((known) => known === code)
}

/** What keeps the invite from being used, as the code whose message explains it. */
export interface DiscordInviteIssue {
  readonly code: DiscordServerErrorCode
  /** Whether asking Discord again can clear it: only when Discord could not be reached. */
  readonly retryable: boolean
}

/**
 * The reason the invite field cannot be submitted, if any. The server's own refusal of the last
 * submit wins over what the form's check said, so the field shows the code the server answered with.
 * An invite that is still being checked, or is valid, has no issue.
 */
export function discordInviteIssue(
  invite: DiscordInviteState,
  serverCode: DiscordServerErrorCode | null
): DiscordInviteIssue | null {
  if (serverCode !== null)
    return { code: serverCode, retryable: serverCode === 'DISCORD_UNAVAILABLE' }

  switch (invite.status) {
    case 'invalid':
      return { code: 'INVALID_DISCORD_INVITE', retryable: false }
    case 'not_voice_call':
      return { code: 'DISCORD_INVITE_NOT_VOICE_CALL', retryable: false }
    case 'unknown':
      return { code: 'DISCORD_UNAVAILABLE', retryable: true }
    default:
      return null
  }
}
