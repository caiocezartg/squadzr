import { describe, expect, it } from 'vitest'
import { errorResponseSchema } from './error'

describe('errorResponseSchema', () => {
  it('accepts an error without a wait', () => {
    expect(errorResponseSchema.parse({ error: 'ROOM_READY', message: 'no' })).toEqual({
      error: 'ROOM_READY',
      message: 'no',
    })
  })

  it('keeps the wait of a rate limit apart from the validation details', () => {
    const parsed = errorResponseSchema.parse({
      error: 'CHAT_RATE_LIMITED',
      message: 'slow',
      retryAfterMs: 6_000,
    })

    expect(parsed.retryAfterMs).toBe(6_000)
    expect(parsed.details).toBeUndefined()
  })

  it.each([0, -1, 1.5, '6000'])('rejects %s as a wait', (retryAfterMs) => {
    const result = errorResponseSchema.safeParse({ error: 'X', message: 'y', retryAfterMs })

    expect(result.success).toBe(false)
  })
})
