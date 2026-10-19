import { StrictMode, useLayoutEffect, useState } from 'react'
import { RouterProvider } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'
import { MotionProvider } from '@/components/ui/motion-provider'
import { legacyNavigatorFor, registerLegacyNavigator } from '@/lib/navigation'
import { createRouterHistory } from '@/lib/router-history'
import { createAppRouter } from './router'

type ShellRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: ShellRouter
  }
}

/** The old app's router for one mount, with the browser history it reads the URL from. */
interface Shell {
  readonly router: ShellRouter
  readonly history: RouterHistory
}

/**
 * Builds the old app's router for this mount of the catch-all. Next writes the URL without telling the
 * old app's router, so a router kept from an earlier mount would render the path it saw last. Each
 * mount reads the URL it mounts at, and unmounting unregisters its navigator and destroys its history.
 */
function useShell(): Shell | null {
  const [shell, setShell] = useState<Shell | null>(null)

  // A layout effect sets the shell before the browser paints, so the first paint already has the routes.
  useLayoutEffect(() => {
    const history = createRouterHistory()
    const router = createAppRouter(history)
    // While this app is mounted, the shell's links and imperative navigation use its router for the
    // routes it owns.
    const unregister = registerLegacyNavigator(legacyNavigatorFor(router))
    setShell({ router, history })

    return () => {
      unregister()
      history.destroy()
    }
  }, [])

  return shell
}

export default function AppShell() {
  const shell = useShell()
  if (!shell) return null

  return (
    <StrictMode>
      <MotionProvider>
        <RouterProvider router={shell.router} />
      </MotionProvider>
    </StrictMode>
  )
}
