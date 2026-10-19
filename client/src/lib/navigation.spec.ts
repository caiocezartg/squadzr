/**
 * The shell's navigation helper (CCC-76). While the catch-all is mounted, a path the old app owns
 * navigates with its router; every other path navigates with the Next router.
 */

import { describe, expect, it, vi } from 'vitest'
import { legacyNavigatorFor, navigateTo, registerLegacyNavigator } from './navigation'
import type { LegacyRouter } from './navigation'

/** A stand-in old-app router that owns exactly `owned`, by pathname. */
function legacyRouter(owned: readonly string[]) {
  const navigate = vi.fn(async (_options: { readonly href: string }) => undefined)
  const router: LegacyRouter = {
    getMatchedRoutes: (pathname) => ({ foundRoute: owned.includes(pathname) ? {} : undefined }),
    navigate,
  }
  return { router, navigate }
}

describe('navigateTo', () => {
  it('navigates the old app for a path it owns while the catch-all is mounted', () => {
    const { router, navigate } = legacyRouter(['/rooms/ABC123'])
    const nextRouter = { push: vi.fn() }
    const unregister = registerLegacyNavigator(legacyNavigatorFor(router))

    navigateTo('/rooms/ABC123?from=bell#top', nextRouter)

    expect(navigate).toHaveBeenCalledWith({ href: '/rooms/ABC123?from=bell#top' })
    expect(nextRouter.push).not.toHaveBeenCalled()
    unregister()
  })

  it('navigates the Next router for a path the old app does not own', () => {
    const { router, navigate } = legacyRouter(['/rooms'])
    const nextRouter = { push: vi.fn() }
    const unregister = registerLegacyNavigator(legacyNavigatorFor(router))

    navigateTo('/', nextRouter)

    expect(nextRouter.push).toHaveBeenCalledWith('/')
    expect(navigate).not.toHaveBeenCalled()
    unregister()
  })

  it('navigates the Next router when no catch-all is mounted', () => {
    const { navigate } = legacyRouter(['/rooms'])
    const nextRouter = { push: vi.fn() }

    navigateTo('/rooms', nextRouter)

    expect(nextRouter.push).toHaveBeenCalledWith('/rooms')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('stops using the old app once its catch-all unmounts', () => {
    const { router, navigate } = legacyRouter(['/rooms'])
    const nextRouter = { push: vi.fn() }
    const unregister = registerLegacyNavigator(legacyNavigatorFor(router))
    unregister()

    navigateTo('/rooms', nextRouter)

    expect(nextRouter.push).toHaveBeenCalledWith('/rooms')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('keeps a newer navigator when an older one unregisters', () => {
    const older = legacyRouter(['/rooms'])
    const newer = legacyRouter(['/rooms'])
    const nextRouter = { push: vi.fn() }
    const unregisterOlder = registerLegacyNavigator(legacyNavigatorFor(older.router))
    const unregisterNewer = registerLegacyNavigator(legacyNavigatorFor(newer.router))

    unregisterOlder()
    navigateTo('/rooms', nextRouter)

    expect(newer.navigate).toHaveBeenCalledWith({ href: '/rooms' })
    expect(nextRouter.push).not.toHaveBeenCalled()
    unregisterNewer()
  })
})
