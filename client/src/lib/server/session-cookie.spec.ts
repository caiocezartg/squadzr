import { describe, expect, it } from 'vitest'
import { hasSessionCookie } from './session-cookie'

describe('hasSessionCookie', () => {
  it('finds the session cookie among others', () => {
    expect(hasSessionCookie('NEXT_LOCALE=en; better-auth.session_token=abc.def; theme=dark')).toBe(
      true
    )
  })

  it('finds the HTTPS variant with the __Secure- prefix', () => {
    expect(hasSessionCookie('__Secure-better-auth.session_token=abc.def')).toBe(true)
  })

  it('has none without a Cookie header', () => {
    expect(hasSessionCookie(null)).toBe(false)
    expect(hasSessionCookie('')).toBe(false)
  })

  it('has none when only other cookies are sent', () => {
    expect(hasSessionCookie('NEXT_LOCALE=en; better-auth.session_data=xyz')).toBe(false)
  })

  it('has none for an empty session cookie or one that only ends with the name', () => {
    expect(hasSessionCookie('better-auth.session_token=')).toBe(false)
    expect(hasSessionCookie('x-better-auth.session_token=abc')).toBe(false)
  })
})
