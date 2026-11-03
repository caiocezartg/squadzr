import { describe, expect, it } from 'vitest'
import { isAllowedRequest } from './origin-guard.plugin'

const ALLOWED = new Set(['https://squadzr.app', 'https://api.squadzr.app'])

function request(method: string, url: string, origin?: string) {
  return { method, url, headers: origin === undefined ? {} : { origin } }
}

describe('isAllowedRequest', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('refuses a %s from another site', (method) => {
    expect(isAllowedRequest(request(method, '/api/rooms', 'https://evil.example'), ALLOWED)).toBe(
      false
    )
  })

  it('accepts a change of state from an allowed origin', () => {
    expect(isAllowedRequest(request('POST', '/api/rooms', 'https://squadzr.app'), ALLOWED)).toBe(
      true
    )
  })

  it('accepts a change of state without an Origin header', () => {
    expect(isAllowedRequest(request('POST', '/api/rooms'), ALLOWED)).toBe(true)
  })

  it.each(['GET', 'HEAD', 'OPTIONS'])('lets a %s from another site through', (method) => {
    expect(isAllowedRequest(request(method, '/api/rooms', 'https://evil.example'), ALLOWED)).toBe(
      true
    )
  })

  it('refuses a WebSocket handshake from another site, query string included', () => {
    expect(isAllowedRequest(request('GET', '/ws', 'https://evil.example'), ALLOWED)).toBe(false)
    expect(isAllowedRequest(request('GET', '/ws?v=1', 'https://evil.example'), ALLOWED)).toBe(false)
  })

  it('accepts a WebSocket handshake from the app', () => {
    expect(isAllowedRequest(request('GET', '/ws', 'https://squadzr.app'), ALLOWED)).toBe(true)
  })

  it('does not mistake a path that only starts like the socket for it', () => {
    expect(isAllowedRequest(request('GET', '/wsx', 'https://evil.example'), ALLOWED)).toBe(true)
  })

  it('refuses the "null" origin a sandboxed page sends', () => {
    expect(isAllowedRequest(request('POST', '/api/rooms', 'null'), ALLOWED)).toBe(false)
  })
})
