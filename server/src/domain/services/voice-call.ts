import type {
  DiscordInviteChannel,
  DiscordServerPreview,
} from './discord-invite-preview-provider.interface'

/** The Discord channel a Squad meets in: what its invite takes a person to. */
export interface VoiceCall {
  readonly id: string
  readonly name: string
}

/** A Voice Call is a voice channel or a stage channel; any other channel, or none, is not one. */
export function isVoiceCall(channel: DiscordInviteChannel | null): channel is DiscordInviteChannel {
  return channel !== null && (channel.kind === 'voice' || channel.kind === 'stage')
}

/** The Voice Call an invite points to, or `null` when its channel is not one. */
export function voiceCallOf(preview: DiscordServerPreview): VoiceCall | null {
  const { channel } = preview
  return isVoiceCall(channel) ? { id: channel.id, name: channel.name } : null
}
