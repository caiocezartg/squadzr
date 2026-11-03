import { describe, expect, it } from 'vitest'
import { checkDiscordLink } from './discord-link'

describe('checkDiscordLink', () => {
  it.each(['https://discord.gg/abc123', 'https://discord.com/invite/abc123'])(
    'accepts the invite %s',
    (link) => {
      expect(checkDiscordLink(link)).toEqual({ valid: true })
    }
  )

  it.each(['', 'not a link', 'discord.gg/abc123'])('calls %j no URL', (link) => {
    expect(checkDiscordLink(link)).toEqual({ valid: false, errorKey: 'discordLinkInvalid' })
  })

  it.each([
    'https://example.com/abc',
    'http://discord.gg/abc',
    'https://discord.gg/',
    'https://discord.gg/??',
    'https://discord.com/invite/',
  ])('calls the URL %s no Discord invite', (link) => {
    expect(checkDiscordLink(link)).toEqual({ valid: false, errorKey: 'discordLinkNotValid' })
  })
})
