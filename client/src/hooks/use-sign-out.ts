import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useEndSession } from '@/hooks/use-session'
import { signOut } from '@/lib/auth-client'
import { useAppNavigation } from '@/lib/navigation'

/**
 * Signs the viewer out in place of a full page load. The load used to drop the viewer's session and
 * cached data with the page, so each is cleared here: the session store, then the query cache. The
 * realtime connections close with the screens that own them: Next keeps the screen the viewer leaves
 * in a hidden Activity, and React runs its effects' cleanup while it is hidden. The player then goes
 * to the landing through the navigation helper.
 */
export function useSignOut(): () => Promise<void> {
  const queryClient = useQueryClient()
  const endSession = useEndSession()
  const navigate = useAppNavigation()

  return useCallback(async () => {
    await signOut()
    endSession()
    queryClient.clear()
    navigate('/')
  }, [endSession, navigate, queryClient])
}
