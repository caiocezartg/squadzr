import { StrictMode, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { MotionProvider } from '@/components/ui/motion-provider'
import { getQueryClient } from '@/lib/query-client'
import { createRouterHistory } from '@/lib/router-history'
import { createAppRouter } from './router'

const router = createAppRouter(createRouterHistory())

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function AppShell() {
  const [queryClient] = useState(getQueryClient)

  return (
    <StrictMode>
      <MotionProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </MotionProvider>
    </StrictMode>
  )
}
