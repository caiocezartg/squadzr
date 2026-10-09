import { useEffect, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { useSession } from '@/lib/auth-client'

interface UseAutoJoinOptions {
  session: ReturnType<typeof useSession>['data']
  mutate: (code: string, options: { onSettled: () => void }) => void
}

/**
 * Joins the room named by the `?join=` search param exactly once, then clears
 * the param so a refresh does not try again. The URL stays the public entry
 * point for shared invites.
 */
export function useAutoJoin({ session, mutate }: UseAutoJoinOptions): void {
  const searchParams = useSearch({ from: '/rooms/' })
  const navigate = useNavigate()
  const autoJoinCodeRef = useRef<string | null>(null)

  useEffect(() => {
    if (!session?.user) return

    const joinCode = searchParams.join

    if (!joinCode || autoJoinCodeRef.current === joinCode) return

    autoJoinCodeRef.current = joinCode
    mutate(joinCode, {
      onSettled: () => {
        // A successful join has already moved the router to the lobby, so the
        // catalog route is no longer matched: navigate to it by absolute path.
        navigate({
          to: '/rooms',
          search: (prev) => {
            const { join: _join, ...rest } = prev
            return rest
          },
          replace: true,
        })
      },
    })
  }, [session?.user, mutate, searchParams.join, navigate])
}
