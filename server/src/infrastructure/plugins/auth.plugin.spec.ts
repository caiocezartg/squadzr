import { describe, expect, it } from 'vitest'
import { authRequestHeaders } from './auth.plugin'

describe('authRequestHeaders', () => {
  it('hands Better Auth the trusted client address, not the one the client wrote', () => {
    const headers = authRequestHeaders(
      { 'x-forwarded-for': '198.51.100.66, 203.0.113.9', cookie: 'a=1' },
      '203.0.113.9'
    )

    expect(headers.get('x-forwarded-for')).toBe('203.0.113.9')
  })

  it('sets the address when the request carried no x-forwarded-for', () => {
    expect(authRequestHeaders({}, '10.0.0.2').get('x-forwarded-for')).toBe('10.0.0.2')
  })

  it('keeps every other header, joining repeated values', () => {
    const headers = authRequestHeaders(
      { cookie: 'a=1', accept: ['text/html', 'application/json'], origin: undefined },
      '10.0.0.2'
    )

    expect(headers.get('cookie')).toBe('a=1')
    expect(headers.get('accept')).toBe('text/html, application/json')
    expect(headers.has('origin')).toBe(false)
  })
})
