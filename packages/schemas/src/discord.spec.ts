import { describe, expect, it } from 'vitest'
import {
  discordInviteCheckResponseSchema,
  discordInviteCode,
  discordInviteCodeParamSchema,
  discordPreviewResponseSchema,
  discordServerPreviewSchema,
  parseDiscordInvite,
} from './discord'

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

describe('discordInviteCode', () => {
  it.each([
    ['https://discord.gg/abc123', 'abc123'],
    ['https://discord.com/invite/premier-qui', 'premier-qui'],
    ['https://discord.gg/abc123/', 'abc123'],
    ['https://discord.gg/abc123?event=1', 'abc123'],
    ['https://discord.gg/abc123#top', 'abc123'],
  ])('reads the code of %s', (link, code) => {
    expect(discordInviteCode(link)).toBe(code)
  })

  it.each([
    'https://discord.gg/',
    'https://discord.gg/../../users/@me',
    'https://discord.gg/ab%2Fcd',
    'https://discord.gg/ab cd',
    'https://discord.gg/?x=1',
    `https://discord.gg/${'a'.repeat(65)}`,
    'https://example.com/abc123',
  ])('has no code for %j', (link) => {
    expect(discordInviteCode(link)).toBeNull()
  })
})

describe('discordPreviewResponseSchema', () => {
  const preview = {
    name: 'VALORANT',
    iconUrl: 'https://cdn.discordapp.com/icons/1/abc.png?size=128',
    backdropUrl: null,
    memberCount: 2_946_792,
    onlineCount: 362_025,
  }

  it('accepts a preview and an absent one', () => {
    expect(discordPreviewResponseSchema.parse({ preview })).toEqual({ preview })
    expect(discordPreviewResponseSchema.parse({ preview: null })).toEqual({ preview: null })
  })

  it('carries no channel: one the server holds is dropped from the response', () => {
    const channel = { id: '1', name: 'Squad call', kind: 'voice' }

    expect(discordPreviewResponseSchema.parse({ preview: { ...preview, channel } })).toEqual({
      preview,
    })
  })

  it('refuses a response without the preview key', () => {
    expect(discordPreviewResponseSchema.safeParse({}).success).toBe(false)
  })

  it.each([
    { name: 1 },
    { iconUrl: 'not a url' },
    { memberCount: -1 },
    { onlineCount: 1.5 },
    { memberCount: undefined },
  ])('refuses a preview with %j', (patch) => {
    expect(discordServerPreviewSchema.safeParse({ ...preview, ...patch }).success).toBe(false)
  })
})

describe('discordInviteCodeParamSchema', () => {
  it.each(['abc123', 'premier-qui', 'A'])('accepts the code %j', (code) => {
    expect(discordInviteCodeParamSchema.parse({ code })).toEqual({ code })
  })

  it.each(['', 'ab cd', 'ab/cd', '..', 'ab%2Fcd', 'a'.repeat(65)])(
    'refuses the code %j',
    (code) => {
      expect(discordInviteCodeParamSchema.safeParse({ code }).success).toBe(false)
    }
  )
})

describe('discordInviteCheckResponseSchema', () => {
  const server = {
    name: 'VALORANT',
    iconUrl: 'https://cdn.discordapp.com/icons/1/abc.png?size=128',
    memberCount: 2_946_792,
  }

  const call = { name: 'Squad call' }

  it.each([
    { status: 'valid', server, call, expires: false },
    {
      status: 'valid',
      server: { ...server, iconUrl: null, memberCount: null },
      call: { name: 'x'.repeat(100) },
      expires: true,
    },
    { status: 'not_voice_call' },
    { status: 'invalid' },
    { status: 'unknown' },
  ])('accepts %j', (response) => {
    expect(discordInviteCheckResponseSchema.parse(response)).toEqual(response)
  })

  it.each([
    {},
    { status: 'expired' },
    { status: 'valid', server, call },
    { status: 'valid', call, expires: false },
    { status: 'valid', server, expires: false },
    { status: 'valid', server, call: { name: '' }, expires: false },
    { status: 'valid', server, call: { name: 'x'.repeat(101) }, expires: false },
    { status: 'valid', server, call: null, expires: false },
    { status: 'valid', server: { ...server, name: 1 }, call, expires: false },
    { status: 'valid', server: { ...server, iconUrl: 'not a url' }, call, expires: false },
    { status: 'valid', server: { ...server, memberCount: -1 }, call, expires: false },
  ])('refuses %j', (response) => {
    expect(discordInviteCheckResponseSchema.safeParse(response).success).toBe(false)
  })
})
