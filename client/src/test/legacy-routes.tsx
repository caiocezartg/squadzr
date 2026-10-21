import { Outlet, createRootRoute, createRoute } from '@tanstack/react-router'
import type { AnyRoute } from '@tanstack/react-router'

/**
 * A stand-in for the old app's routes. `/squads`, `/squads/my` and `/squads/[code]` are App Router
 * pages, so the old app owns none of the app's real paths; the synthetic `/legacy` path exercises the
 * catch-all, the shell's legacy navigator and its route titles without depending on a real page.
 */
export function legacyRouteTree(): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const page = (title: string, label: string) =>
    function Page() {
      return (
        <>
          <title>{title}</title>
          <div>{label}</div>
        </>
      )
    }

  const legacyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/legacy',
    component: page('Legacy page · Squadzr', 'Legacy page'),
  })

  return rootRoute.addChildren([legacyRoute]) as AnyRoute
}
