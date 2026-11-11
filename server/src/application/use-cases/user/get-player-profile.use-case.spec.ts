import { beforeEach, describe, expect, it } from 'vitest'
import { PROFILE_TOP_GAMES_LIMIT } from '@squadzr/schemas'
import { UserNotFoundError } from '@application/errors'
import {
  createMockPlayerStats,
  createMockSquadRecordRepository,
  createMockUser,
  createMockUserRepository,
} from '@test/mocks'
import { GetPlayerProfileUseCase } from './get-player-profile.use-case'

const game = {
  id: 'game-1',
  name: 'Counter-Strike 2',
  slug: 'cs2',
  coverUrl: 'https://cdn.squadzr.test/cs2.webp',
  thumbnailUrl: 'https://cdn.squadzr.test/cs2-thumb.webp',
}

describe('GetPlayerProfileUseCase', () => {
  let userRepository: ReturnType<typeof createMockUserRepository>
  let squadRecordRepository: ReturnType<typeof createMockSquadRecordRepository>
  let useCase: GetPlayerProfileUseCase

  beforeEach(() => {
    userRepository = createMockUserRepository()
    squadRecordRepository = createMockSquadRecordRepository()
    useCase = new GetPlayerProfileUseCase(userRepository, squadRecordRepository)
  })

  it('returns the person and what their completed Squads add up to', async () => {
    const user = createMockUser({ id: 'user-1' })
    const stats = createMockPlayerStats({
      completedSquads: 3,
      gamesPlayed: 1,
      lastSquad: { game, readyAt: new Date('2026-10-01T10:00:00Z') },
      topGames: [{ game, squads: 3, lastReadyAt: new Date('2026-10-01T10:00:00Z') }],
    })
    userRepository.findById.mockResolvedValue(user)
    squadRecordRepository.getPlayerStats.mockResolvedValue(stats)

    const result = await useCase.execute({ id: 'user-1' })

    expect(result).toEqual({ user, stats })
    expect(squadRecordRepository.getPlayerStats).toHaveBeenCalledWith(
      'user-1',
      PROFILE_TOP_GAMES_LIMIT
    )
  })

  it('returns empty stats for a person with no completed Squad', async () => {
    userRepository.findById.mockResolvedValue(createMockUser({ id: 'user-2' }))

    const result = await useCase.execute({ id: 'user-2' })

    expect(result.stats).toEqual({
      completedSquads: 0,
      gamesPlayed: 0,
      lastSquad: null,
      topGames: [],
    })
  })

  it('throws UserNotFoundError and reads no history for an unknown person', async () => {
    userRepository.findById.mockResolvedValue(null)

    const error = await useCase.execute({ id: 'ghost' }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(UserNotFoundError)
    expect(error).toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 })
    expect(squadRecordRepository.getPlayerStats).not.toHaveBeenCalled()
  })
})
