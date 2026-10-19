import { Outlet, createRootRoute, createRoute } from '@tanstack/react-router'
import type { AnyRoute } from '@tanstack/react-router'

/**
 * The old app's routes, each page naming itself and filling in its title. Without the landing, `/`
 * is an App Router page in the scene and the old app does not own it.
 */
export function legacyRouteTree({ landing }: { landing: boolean }): AnyRoute {
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
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: page('Squadzr', 'Home page'),
  })

  const squads = [squadsRoute, lobbyRoute, mySquadsRoute]
  return rootRoute.addChildren(landing ? [homeRoute, ...squads] : squads) as AnyRoute
}
