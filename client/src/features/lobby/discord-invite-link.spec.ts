import { describe, expect, it } from 'vitest'
import { parseDiscordInvite } from './discord-invite-link'

describe('parseDiscordInvite', () => {
  it('reads a discord.gg invite into its host and code', () => {
    expect(parseDiscordInvite('https://discord.gg/premier-qui')).toEqual({
      href: 'https://discord.gg/premier-qui',
      host: 'discord.gg/',
      code: 'premier-qui',
    })
  })

  it('reads a discord.com invite into its host and code', () => {
    expect(parseDiscordInvite('https://discord.com/invite/abc123')).toEqual({
      href: 'https://discord.com/invite/abc123',
      host: 'discord.com/invite/',
      code: 'abc123',
    })
  })

  it.each([
    'http://discord.gg/abc123',
    'https://discord.gg.evil.example/abc123',
    'https://not-discord.example/invite',
    'javascript:alert(1)',
    'discord.gg/abc123',
    'https://discord.gg/',
    'https://discord.com/invite/',
    '',
  ])('refuses %j', (link) => {
    expect(parseDiscordInvite(link)).toBeNull()
  })
})
