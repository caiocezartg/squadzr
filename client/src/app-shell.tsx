import { StrictMode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient } from '@/lib/query-client'
import { createRouterHistory } from '@/lib/router-history'
import { createAppRouter } from './router'
import '@/lib/i18n'

const router = createAppRouter(createRouterHistory())

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function AppShell() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  )
}
