import { describe, expect, it } from 'vitest'
import { createRoomInputSchema } from './index'
import { userNotificationPayloadSchema } from './notification'

describe('createRoomInputSchema', () => {
  it('accepts a valid payload and applies defaults', () => {
    const result = createRoomInputSchema.parse({
      name: '  Ranked 5v5  ',
      gameId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      discordLink: 'https://discord.gg/squadzr',
    })

    expect(result.name).toBe('Ranked 5v5')
    expect(result.tags).toEqual([])
    expect(result.language).toBe('pt-br')
  })

  it('normalizes tags to lowercase without leading hashes', () => {
    const result = createRoomInputSchema.parse({
      name: 'FIFA night',
      gameId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      tags: ['#CS2', 'VALORANT'],
      discordLink: 'https://discord.com/invite/abc123',
    })

    expect(result.tags).toEqual(['cs2', 'valorant'])
  })

  const tagsInput = (tags: string[]) => ({
    name: 'FIFA night',
    gameId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    tags,
    discordLink: 'https://discord.gg/squadzr',
  })

  it('does not count the leading hashes toward the tag limit', () => {
    const result = createRoomInputSchema.parse(tagsInput(['##Ranked', 'a'.repeat(12)]))

    expect(result.tags).toEqual(['ranked', 'a'.repeat(12)])
  })

  it('keeps letters with accents, digits and hyphens in a tag', () => {
    const result = createRoomInputSchema.parse(tagsInput(['Clã-BR', 'cs2', 'só-hoje']))

    expect(result.tags).toEqual(['clã-br', 'cs2', 'só-hoje'])
  })

  it('rejects a tag longer than 12 characters', () => {
    const result = createRoomInputSchema.safeParse(tagsInput(['a'.repeat(13)]))

    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['Tag too long'])
  })

  it.each(['two words', 'ranked!', 'a_b', 'a.b', '#', '', '-', '---'])(
    'rejects the tag %j as not one word',
    (tag) => {
      const result = createRoomInputSchema.safeParse(tagsInput([tag]))

      expect(result.error?.issues.map((issue) => issue.message)).toEqual(['Tag must be one word'])
    }
  )

  it('rejects more than 5 tags', () => {
    const result = createRoomInputSchema.safeParse(tagsInput(['a', 'b', 'c', 'd', 'e', 'f']))

    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['Max 5 tags'])
  })

  it.each(['https://discord.gg/', 'https://discord.gg/??', 'https://discord.com/invite/'])(
    'rejects the invite link %j that carries no invite code',
    (discordLink) => {
      const result = createRoomInputSchema.safeParse({ ...tagsInput([]), discordLink })

      expect(result.error?.issues.map((issue) => issue.message)).toEqual([
        'Discord link must be a valid Discord invite URL',
      ])
    }
  )

  it('rejects an empty room name', () => {
    expect(() =>
      createRoomInputSchema.parse({
        name: '   ',
        gameId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        discordLink: 'https://discord.gg/squadzr',
      })
    ).toThrow()
  })

  it('rejects a non-Discord invite link', () => {
    expect(() =>
      createRoomInputSchema.parse({
        name: 'Ranked 5v5',
        gameId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        discordLink: 'https://example.com/invite',
      })
    ).toThrow()
  })
})

describe('userNotificationPayloadSchema', () => {
  const base = {
    roomId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    roomName: 'Ranked 5v5',
    gameName: 'Counter-Strike 2',
    players: [{ name: 'caio', image: null }],
    discordLink: 'https://discord.gg/squadzr',
  }

  it('requires a 6-character room code', () => {
    expect(userNotificationPayloadSchema.parse({ ...base, roomCode: 'ABC123' })).toMatchObject({
      roomCode: 'ABC123',
    })
    expect(() => userNotificationPayloadSchema.parse({ ...base, roomCode: 'AB12' })).toThrow()
  })

  it('accepts a game cover and keeps it in the payload', () => {
    const parsed = userNotificationPayloadSchema.parse({
      ...base,
      roomCode: 'ABC123',
      gameCoverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/lol.jpg',
    })

    expect(parsed.gameCoverUrl).toBe(
      'https://images.igdb.com/igdb/image/upload/t_cover_big/lol.jpg'
    )
  })

  it('parses a payload written before the game cover existed', () => {
    const parsed = userNotificationPayloadSchema.parse({ ...base, roomCode: 'ABC123' })

    expect(parsed.gameCoverUrl).toBeUndefined()
  })
})
