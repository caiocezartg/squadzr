import { Outlet, createRootRoute, createRoute } from '@tanstack/react-router'
import type { AnyRoute } from '@tanstack/react-router'

/**
 * The old app's routes, each page naming itself and filling in its title. `/` is not among them: the
 * landing is an App Router page, so the old app does not own that path.
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

  const squadsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/',
    component: page('Squads · Squadzr', 'Squads page'),
  })
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

  return rootRoute.addChildren([squadsRoute, lobbyRoute, mySquadsRoute]) as AnyRoute
}
