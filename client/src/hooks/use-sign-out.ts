import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEndSession } from '@/hooks/use-session'
import { signOut } from '@/lib/auth-client'
import { useAppNavigation } from '@/lib/navigation'
import { notifyError } from '@/lib/notify'

/**
 * Signs the viewer out in place of a full page load. The load used to drop the viewer's session and
 * cached data with the page, so each is cleared here: the session store, then the query cache. The
 * screens that own a realtime connection close it as they leave: Next keeps the screen the viewer
 * leaves in a hidden Activity, and React runs its effects' cleanup while that is hidden.
 *
 * The player then goes to the landing through the navigation helper. The refresh after it invalidates
 * Next's back-navigation cache, which may hold the screens the viewer had open while signed in. A
 * sign-out that the server refuses keeps the session and says so.
 */
export function useSignOut(): () => Promise<void> {
  const t = useTranslations()
  const router = useRouter()
  const queryClient = useQueryClient()
  const endSession = useEndSession()
  const navigate = useAppNavigation()

  return useCallback(async () => {
    // A rejected call and an error answer both leave the server's session in place.
    const result = await signOut().catch(() => undefined)
    if (!result || result.error) {
      notifyError(t('errors.DEFAULT'))
      return
    }

    endSession()
    queryClient.clear()
    navigate('/')
    // The screen the viewer left is kept for back navigation once the navigation hides it, so the
    // refresh comes after the navigation.
    router.refresh()
  }, [endSession, navigate, queryClient, router, t])
}
