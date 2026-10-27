/**
 * The Lobby route and the retired My Squads paths (CCC-107). `/squads/my` and, through its redirect,
 * `/rooms/my` end in the app's 404 for every viewer, because `my` is not a Squad code.
 */

import { describe, expect, it, vi } from 'vitest'
import { notFound } from 'next/navigation'
import LobbyRoute, { generateMetadata } from './page'

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  }),
}))
vi.mock('@/lib/server/viewer', () => ({
  getRequestViewer: async () => ({ cookie: null, forwardedFor: null }),
}))

const params = (code: string) => ({ params: Promise.resolve({ code }) })

describe('the Lobby route and the retired My Squads paths', () => {
  it.each(['my', 'MY', 'My'])('answers 404 for /squads/%s, page and metadata', async (code) => {
    await expect(LobbyRoute(params(code))).rejects.toThrow('404')
    await expect(generateMetadata(params(code))).rejects.toThrow('404')
    expect(notFound).toHaveBeenCalled()
  })

  it('sends /rooms/my to /squads/my, which answers 404', async () => {
    const config = (await import('../../../../../next.config')).default
    const redirects = (await config.redirects?.()) ?? []

    expect(redirects).toContainEqual({
      source: '/rooms/:code',
      destination: '/squads/:code',
      permanent: true,
    })
    await expect(LobbyRoute(params('my'))).rejects.toThrow('404')
  })
})
