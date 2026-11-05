/**
 * The head of an admin page: an admin's carries the panel's `noindex`, and everyone else's, and a
 * session that cannot be read, is the not-found page's own, so a 404 under /admin reveals nothing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionDto } from '@squadzr/schemas'
import { getRequestSession } from './session'
import { adminMetadata } from './admin-metadata'

vi.mock('server-only', () => ({}))
vi.mock('./session', () => ({ getRequestSession: vi.fn() }))

const sessionOf = (role: SessionDto['user']['role']): SessionDto => ({
  user: { id: 'user-1', name: 'Caio', email: 'caio@squadzr.test', image: null, role },
})

const panelHead = { title: 'Audit', robots: { index: false, follow: false } }

beforeEach(() => {
  vi.mocked(getRequestSession).mockReset()
})

describe('adminMetadata', () => {
  it('gives an admin the panel head, which keeps the page out of search engines', async () => {
    vi.mocked(getRequestSession).mockResolvedValue(sessionOf('admin'))

    await expect(adminMetadata(panelHead)).resolves.toEqual(panelHead)
  })

  it.each([
    ['a signed-out visitor', null],
    ['a user', sessionOf('user')],
  ])('gives %s the not-found head', async (_, session) => {
    vi.mocked(getRequestSession).mockResolvedValue(session)

    await expect(adminMetadata(panelHead)).resolves.toEqual({
      title: { absolute: 'Page not found · Squadzr' },
    })
  })

  it('gives the not-found head when the session read fails', async () => {
    vi.mocked(getRequestSession).mockRejectedValue(new Error('Database unavailable'))

    await expect(adminMetadata(panelHead)).resolves.toEqual({
      title: { absolute: 'Page not found · Squadzr' },
    })
  })
})
