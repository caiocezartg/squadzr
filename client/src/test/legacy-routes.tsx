import { Outlet, createRootRoute, createRoute } from '@tanstack/react-router'
import type { AnyRoute } from '@tanstack/react-router'

/**
 * The old app's routes, each page naming itself and filling in its title. `/` and `/squads` are not
 * among them: the landing and the Squad Board are App Router pages, so the old app does not own those paths.
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

  const lobbyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/$code',
    component: page('Lobby · Squadzr', 'Lobby page'),
  })
  const mySquadsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/my',
    component: page('My squads · Squadzr', 'My squads page'),
  })

  return rootRoute.addChildren([lobbyRoute, mySquadsRoute]) as AnyRoute
}
