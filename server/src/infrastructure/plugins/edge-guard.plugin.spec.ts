import { describe, expect, it } from 'vitest'
import { hasEdgeToken, isHealthPath } from './edge-guard.plugin'

describe('isHealthPath', () => {
  it.each(['/health', '/health/ready', '/health?probe=1', '/health/ready?a=b'])(
    'exempts %s',
    (url) => {
      expect(isHealthPath(url)).toBe(true)
    }
  )

  it.each(['/', '/health/', '/health/ready/', '/health/live', '/healthz', '/api/health', '/ws'])(
    'does not exempt %s',
    (url) => {
      expect(isHealthPath(url)).toBe(false)
    }
  )

  it('does not let the query string stand in for the path', () => {
    expect(isHealthPath('/api/rooms?next=/health')).toBe(false)
  })
})

describe('hasEdgeToken', () => {
  const TOKEN = 'edge-secret-0123456789abcdef-0123456789'

  it('accepts the secret', () => {
    expect(hasEdgeToken(TOKEN, TOKEN)).toBe(true)
  })

  it.each([undefined, '', 'wrong', `${TOKEN}x`, TOKEN.slice(1), [TOKEN]])(
    'refuses %j',
    (received) => {
      expect(hasEdgeToken(received, TOKEN)).toBe(false)
    }
  )
})
