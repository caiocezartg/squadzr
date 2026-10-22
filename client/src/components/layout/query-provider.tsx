'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'

/**
 * The React Query client that the shell and the old app share. The root layout mounts it above the
 * header, so the header's notifications and the routes read one cache.
 */
export function QueryProvider({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(getQueryClient)

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
