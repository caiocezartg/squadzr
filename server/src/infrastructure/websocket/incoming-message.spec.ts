import { describe, expect, it } from 'vitest'
import { parseIncomingMessage } from './incoming-message'

const SECRET = 'PrivateSessionTokenXYZ'

describe('parseIncomingMessage', () => {
  it('returns the validated message of a JSON frame', () => {
    const result = parseIncomingMessage(
      Buffer.from(JSON.stringify({ type: 'join_room', payload: { roomCode: 'ABC123' } }))
    )

    expect(result).toMatchObject({
      ok: true,
      message: { type: 'join_room', payload: { roomCode: 'ABC123' } },
    })
  })

  it.each([
    ['a bare identifier', SECRET],
    ['truncated JSON', `{"type":"join_room","payload":{"sessionToken":"${SECRET}`],
    ['an empty frame', ''],
  ])('rejects %s as PARSE_ERROR without quoting the frame', (_label, frame) => {
    const result = parseIncomingMessage(Buffer.from(frame))

    expect(result).toEqual({
      ok: false,
      code: 'PARSE_ERROR',
      reason: 'Failed to parse message',
      issues: [{ path: '', code: 'invalid_json' }],
    })
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })

  it('rejects a JSON frame that breaks the contract as INVALID_MESSAGE, by issue path and code', () => {
    const result = parseIncomingMessage(
      Buffer.from(JSON.stringify({ type: 'join_room', payload: { roomCode: SECRET } }))
    )

    expect(result).toEqual({
      ok: false,
      code: 'INVALID_MESSAGE',
      reason: 'Invalid message format',
      issues: [{ path: 'payload.roomCode', code: expect.any(String) }],
    })
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })
})
