/**
 * The admin gate fails closed: an admin gets their session, and everyone else, a signed-out visitor,
 * a plain user and a session that could not be read at all, gets the app's not-found page.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notFound } from 'next/navigation'
import type { SessionDto } from '@squadzr/schemas'
import { getRequestSession } from './session'
import { requireAdminSession } from './admin-gate'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  }),
}))
vi.mock('./session', () => ({ getRequestSession: vi.fn() }))

const sessionOf = (role: SessionDto['user']['role']): SessionDto => ({
  user: { id: 'user-1', name: 'Caio', email: 'caio@squadzr.test', image: null, role },
})

beforeEach(() => {
  vi.mocked(notFound).mockClear()
  vi.mocked(getRequestSession).mockReset()
})

describe('requireAdminSession', () => {
  it('returns the session of an admin', async () => {
    vi.mocked(getRequestSession).mockResolvedValue(sessionOf('admin'))

    await expect(requireAdminSession()).resolves.toEqual(sessionOf('admin'))
    expect(notFound).not.toHaveBeenCalled()
  })

  it.each([
    ['a signed-out visitor', null],
    ['a user', sessionOf('user')],
  ])('answers not-found to %s', async (_, session) => {
    vi.mocked(getRequestSession).mockResolvedValue(session)

    await expect(requireAdminSession()).rejects.toThrow('404')
    expect(notFound).toHaveBeenCalledOnce()
  })

  it('answers not-found when the session read fails', async () => {
    vi.mocked(getRequestSession).mockRejectedValue(new Error('Database unavailable'))

    await expect(requireAdminSession()).rejects.toThrow('404')
    expect(notFound).toHaveBeenCalledOnce()
  })
})
