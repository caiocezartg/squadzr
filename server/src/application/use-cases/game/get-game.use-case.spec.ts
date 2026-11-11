import { describe, it, expect, beforeEach } from 'vitest'
import { GetGameUseCase } from './get-game.use-case'
import { GameNotFoundError } from '@application/errors'
import { createMockGame, createMockGameRepository } from '@test/mocks'

describe('GetGameUseCase', () => {
  let useCase: GetGameUseCase
  let mockGameRepository: ReturnType<typeof createMockGameRepository>

  beforeEach(() => {
    mockGameRepository = createMockGameRepository()
    useCase = new GetGameUseCase(mockGameRepository)
  })

  describe('execute', () => {
    it('should return the game when found', async () => {
      const expectedGame = createMockGame({ id: 'game-123' })
      mockGameRepository.findById.mockResolvedValue(expectedGame)

      const result = await useCase.execute({ id: 'game-123' })

      expect(result.game).toEqual(expectedGame)
      expect(mockGameRepository.findById).toHaveBeenCalledWith('game-123')
      expect(mockGameRepository.findById).toHaveBeenCalledOnce()
    })

    it('should throw GameNotFoundError when the game does not exist', async () => {
      mockGameRepository.findById.mockResolvedValue(null)

      const error = await useCase.execute({ id: 'missing' }).catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(GameNotFoundError)
      expect(error).toMatchObject({ code: 'GAME_NOT_FOUND', statusCode: 404 })
    })
  })
})
