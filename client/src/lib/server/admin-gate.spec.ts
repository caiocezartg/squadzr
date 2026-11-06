/**
 * The admin gates fail closed: the panel gate admits a moderator, an admin and the owner, the full gate
 * only an admin and the owner, and everyone else, a signed-out visitor, a plain user and a session that
 * could not be read at all, gets the app's not-found page.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notFound } from 'next/navigation'
import type { SessionDto } from '@squadzr/schemas'
import { getRequestSession } from './session'
import { requireAdminSession, requireFullAdminSession } from './admin-gate'

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
  it.each(['moderator', 'admin', 'owner'] as const)('returns the session of a %s', async (role) => {
    vi.mocked(getRequestSession).mockResolvedValue(sessionOf(role))

    await expect(requireAdminSession()).resolves.toEqual(sessionOf(role))
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

describe('requireFullAdminSession', () => {
  it.each(['admin', 'owner'] as const)('returns the session of an %s', async (role) => {
    vi.mocked(getRequestSession).mockResolvedValue(sessionOf(role))

    await expect(requireFullAdminSession()).resolves.toEqual(sessionOf(role))
    expect(notFound).not.toHaveBeenCalled()
  })

  it.each([
    ['a signed-out visitor', null],
    ['a user', sessionOf('user')],
    ['a moderator', sessionOf('moderator')],
  ])('answers not-found to %s', async (_, session) => {
    vi.mocked(getRequestSession).mockResolvedValue(session)

    await expect(requireFullAdminSession()).rejects.toThrow('404')
    expect(notFound).toHaveBeenCalledOnce()
  })

  it('answers not-found when the session read fails', async () => {
    vi.mocked(getRequestSession).mockRejectedValue(new Error('Database unavailable'))

    await expect(requireFullAdminSession()).rejects.toThrow('404')
  })
})
