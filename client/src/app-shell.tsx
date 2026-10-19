import { StrictMode, useEffect } from 'react'
import { RouterProvider } from '@tanstack/react-router'
import { MotionProvider } from '@/components/ui/motion-provider'
import { legacyNavigatorFor, registerLegacyNavigator } from '@/lib/navigation'
import { createRouterHistory } from '@/lib/router-history'
import { createAppRouter } from './router'

const router = createAppRouter(createRouterHistory())

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function AppShell() {
  // While this app is mounted, the shell's links and imperative navigation use its router for the
  // routes it owns.
  useEffect(() => registerLegacyNavigator(legacyNavigatorFor(router)), [])

  return (
    <StrictMode>
      <MotionProvider>
        <RouterProvider router={router} />
      </MotionProvider>
    </StrictMode>
  )
}
