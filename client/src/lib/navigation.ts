import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The one navigation helper for the shell. The shell sits in the Next root layout, outside the old
 * app's TanStack Router, so its links and its imperative navigation go through here. While the
 * catch-all is mounted, a path the old app owns is a client-side TanStack navigation; every other
 * path goes through the Next router, into an App Router page or out of one.
 */

/** What the shell needs from the old app's router: its route table and a client-side navigation. */
export interface LegacyRouter {
  getMatchedRoutes(pathname: string): { readonly foundRoute?: unknown }
  navigate(options: { readonly href: string }): Promise<unknown>
}

/** The navigator the catch-all registers while it is mounted. */
export interface LegacyNavigator {
  owns(pathname: string): boolean
  navigate(href: string): void
}

/** The part of the Next router that the helper uses. */
interface AppRouter {
  push(href: string): void
}

let legacy: LegacyNavigator | null = null

/**
 * Builds the navigator from the old app's router. Its route table decides which paths the old app
 * owns, so a route that leaves the table moves to the App Router with no list to keep in step.
 */
export function legacyNavigatorFor(router: LegacyRouter): LegacyNavigator {
  return {
    owns: (pathname) => router.getMatchedRoutes(pathname).foundRoute !== undefined,
    navigate: (href) => {
      void router.navigate({ href })
    },
  }
}

/**
 * Registers the old app's navigator while the catch-all is mounted. Returns the cleanup that
 * unregisters it, so a navigator never outlives the mount that registered it.
 */
export function registerLegacyNavigator(navigator: LegacyNavigator): () => void {
  legacy = navigator
  return () => {
    if (legacy === navigator) legacy = null
  }
}

/**
 * Navigates to `href`. TanStack Router navigates when the catch-all is mounted and the old app owns
 * the path; the Next router navigates otherwise.
 */
export function navigateTo(href: string, router: AppRouter): void {
  const current = legacy
  const [pathname = href] = href.split(/[?#]/, 1)

  if (current?.owns(pathname)) current.navigate(href)
  else router.push(href)
}

/** The navigate function of a component, bound to the Next router. */
export function useAppNavigation(): (href: string) => void {
  const router = useRouter()

  return useCallback((href: string) => navigateTo(href, router), [router])
}
