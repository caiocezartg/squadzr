import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { markerPayload, parsePlayers, parseVerify } from './data-commands'
import { signedSessionCookie } from './data'

describe('data command output', () => {
  const noise = 'Using SSH key from file x\n'

  it('finds a marker line among other output', () => {
    expect(markerPayload(`${noise}LT_VERIFY {"users":0}\r\n`, 'LT_VERIFY')).toBe('{"users":0}')
    expect(markerPayload(noise, 'LT_VERIFY')).toBeNull()
  })

  it('parses the provisioned players', () => {
    const stdout = `${noise}LT_PLAYERS [{"id":"u1","cookie":"c=1"}]\n`

    expect(parsePlayers(stdout)).toEqual([{ id: 'u1', cookie: 'c=1' }])
    expect(() => parsePlayers(noise)).toThrow('LT_PLAYERS')
    expect(() => parsePlayers('LT_PLAYERS [{"id":"u1"}]')).toThrow()
  })

  it('parses the verify counts and the audit entry total', () => {
    const stdout = 'LT_VERIFY {"users":0,"squads":2}\nLT_AUDIT_ENTRIES 41\n'

    expect(parseVerify(stdout)).toEqual({ counts: { users: 0, squads: 2 }, auditEntries: 41 })
    expect(() => parseVerify('LT_VERIFY {"users":-1}')).toThrow()
  })
})

describe('signedSessionCookie', () => {
  const secret = 's'.repeat(32)

  it('signs the token the way Better Auth does, under the secure name over https', () => {
    const cookie = signedSessionCookie('tok', secret, true)
    const signature = createHmac('sha256', secret).update('tok').digest('base64')

    expect(cookie).toBe(
      `__Secure-better-auth.session_token=${encodeURIComponent(`tok.${signature}`)}`
    )
  })

  it('drops the secure prefix over plain http', () => {
    expect(signedSessionCookie('tok', secret, false).startsWith('better-auth.session_token=')).toBe(
      true
    )
  })
})
