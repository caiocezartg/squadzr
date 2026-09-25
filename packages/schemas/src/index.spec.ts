import { describe, expect, it } from 'vitest'
import { createRoomInputSchema, roomStatusSchema, userNotificationPayloadSchema } from './index'

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

describe('roomStatusSchema', () => {
  it('only accepts the supported room statuses', () => {
    expect(roomStatusSchema.parse('waiting')).toBe('waiting')
    expect(() => roomStatusSchema.parse('cancelled')).toThrow()
  })
})

describe('userNotificationPayloadSchema', () => {
  it('requires a 6-character room code', () => {
    const base = {
      roomId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      roomName: 'Ranked 5v5',
      gameName: 'Counter-Strike 2',
      players: [{ name: 'caio', image: null }],
      discordLink: 'https://discord.gg/squadzr',
    }

    expect(userNotificationPayloadSchema.parse({ ...base, roomCode: 'ABC123' })).toMatchObject({
      roomCode: 'ABC123',
    })
    expect(() => userNotificationPayloadSchema.parse({ ...base, roomCode: 'AB12' })).toThrow()
  })
})
