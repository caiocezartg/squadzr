import { createRouter } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'
import { RoutePending } from '@/components/route-pending'
import { routeTree } from './routeTree.gen'

/**
 * Router behaviour shared by the app entry and its tests: routes are
 * code-split, so navigating to an on-demand route can show the route pending
 * state. `pendingMs` and `pendingMinMs` intentionally stay at the TanStack
 * Router defaults (1000 ms and 500 ms): a chunk that resolves within the first
 * second never flashes the loading state, and a slow one keeps it up long
 * enough to be noticed instead of flickering.
 */
export const routerDefaults = {
  defaultPendingComponent: RoutePending,
} as const

/** Builds the app router used by the app entry; tests reuse `routerDefaults`. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    ...(history ? { history } : {}),
    ...routerDefaults,
  })
}
