import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The navigation helper for components that navigate imperatively. Every route is an App Router
 * page, so it always goes through the Next router.
 */
export function useAppNavigation(): (href: string) => void {
  const router = useRouter()

  return useCallback((href: string) => router.push(href), [router])
}
