import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { CheckReadinessUseCase } from './check-readiness.use-case'

describe('CheckReadinessUseCase', () => {
  let ping: Mock<() => Promise<void>>
  let useCase: CheckReadinessUseCase

  beforeEach(() => {
    ping = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    useCase = new CheckReadinessUseCase({ ping })
  })

  describe('execute', () => {
    it('should report ready when the database answers', async () => {
      const result = await useCase.execute()

      expect(result).toEqual({ ready: true })
      expect(ping).toHaveBeenCalledOnce()
    })

    it('should report not ready when the database does not answer', async () => {
      ping.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:1'))

      const result = await useCase.execute()

      expect(result).toEqual({ ready: false })
    })
  })
})
