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
 * screens that own a realtime connection close it as they leave: the navigation below replaces the
 * current page, React unmounts it, and the unmount runs the socket's effect cleanup. Next hides
 * a left screen in an Activity only with `cacheComponents`, which this app does not set.
 *
 * The player then goes to the landing through the navigation helper. The refresh comes after that
 * navigation: the router runs a refresh only once a pending navigation has finished, and a navigation
 * discards a refresh that is still pending. The refresh re-renders the landing with the session the
 * server now sees, and it invalidates Next's segment cache and BFCache, which may hold the data of the
 * screens the viewer had open while signed in. A sign-out that the server refuses keeps the session and
 * says so.
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
