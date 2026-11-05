import { describe, expect, it } from 'vitest'
import { playerProfileSchema } from '@squadzr/schemas'
import { createMockPlayerStats, createMockUser } from '@test/mocks'
import { toPlayerProfileDto } from './player-profile.projection'

const game = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  name: 'Counter-Strike 2',
  slug: 'cs2',
  coverUrl: 'https://cdn.squadzr.test/cs2.webp',
  thumbnailUrl: 'https://cdn.squadzr.test/cs2-thumb.webp',
}
const readyAt = new Date('2026-10-01T10:00:00.000Z')

describe('toPlayerProfileDto', () => {
  it('maps the user and the stats into the contract', () => {
    const user = createMockUser({
      id: 'user-1',
      name: 'Caio',
      avatarUrl: 'https://cdn.squadzr.test/caio.png',
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
    })
    const stats = createMockPlayerStats({
      completedSquads: 4,
      gamesPlayed: 1,
      lastSquad: { game, readyAt },
      topGames: [{ game, squads: 4, lastReadyAt: readyAt }],
    })

    const dto = toPlayerProfileDto(user, stats)

    expect(dto).toEqual({
      id: 'user-1',
      name: 'Caio',
      image: 'https://cdn.squadzr.test/caio.png',
      memberSince: '2026-01-05T00:00:00.000Z',
      completedSquads: 4,
      gamesPlayed: 1,
      lastSquad: {
        game: {
          id: game.id,
          name: 'Counter-Strike 2',
          slug: 'cs2',
          coverUrl: game.coverUrl,
          coverThumbUrl: game.thumbnailUrl,
        },
        readyAt: '2026-10-01T10:00:00.000Z',
      },
      topGames: [
        {
          game: {
            id: game.id,
            name: 'Counter-Strike 2',
            slug: 'cs2',
            coverUrl: game.coverUrl,
            coverThumbUrl: game.thumbnailUrl,
          },
          squads: 4,
        },
      ],
    })
    expect(playerProfileSchema.parse(dto)).toEqual(dto)
  })

  it('maps a person without history to null and an empty list', () => {
    const dto = toPlayerProfileDto(createMockUser(), createMockPlayerStats())

    expect(dto).toMatchObject({
      image: null,
      completedSquads: 0,
      gamesPlayed: 0,
      lastSquad: null,
      topGames: [],
    })
  })

  it('never exposes the email or the update time of the user', () => {
    const dto = toPlayerProfileDto(
      createMockUser({ email: 'private@example.com' }),
      createMockPlayerStats()
    )

    expect(dto).not.toHaveProperty('email')
    expect(dto).not.toHaveProperty('updatedAt')
    expect(JSON.stringify(dto)).not.toContain('private@example.com')
  })
})
