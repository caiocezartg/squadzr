import { createRouter } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'
import { RoutePending } from '@/components/route-pending'
import { routeTree } from './routeTree.gen'

/**
 * Router behaviour shared by the app entry and its tests: routes are
 * code-split, so navigating to an on-demand route shows the loading state when
 * its chunk takes longer than a quick cache hit would.
 */
export const routerDefaults = {
  defaultPendingComponent: RoutePending,
  defaultPendingMs: 150,
  defaultPendingMinMs: 300,
} as const

/** Builds the app router used by the app entry; tests reuse `routerDefaults`. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    ...(history ? { history } : {}),
    ...routerDefaults,
  })
}
