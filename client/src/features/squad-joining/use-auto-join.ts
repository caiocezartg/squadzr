import { useEffect, useRef } from 'react'
import type { SessionDto } from '@squadzr/schemas'
import type { SquadSearchAccess } from '@/features/squad-list'

interface UseAutoJoinOptions {
  search: SquadSearchAccess
  session: SessionDto | null
  mutate: (code: string, options: { onSettled: () => void }) => void
}

/**
 * Joins the squad named by the `?join=` search param exactly once, then clears
 * the param so a refresh does not try again. The URL stays the public entry
 * point for shared invites.
 */
export function useAutoJoin({ search, session, mutate }: UseAutoJoinOptions): void {
  const { search: current, replace } = search
  const joinCode = current.join
  const autoJoinCodeRef = useRef<string | null>(null)

  useEffect(() => {
    if (!session?.user) return

    if (!joinCode || autoJoinCodeRef.current === joinCode) return

    autoJoinCodeRef.current = joinCode
    mutate(joinCode, {
      onSettled: () => {
        // The clear writes the board's URL without its join param. A successful join has already started
        // its navigation to the lobby; this write arrives while that navigation is in flight and discards it,
        // so the board stays on screen as the join settles.
        const { join: _join, ...rest } = current
        replace(rest)
      },
    })
  }, [session?.user, mutate, joinCode, current, replace])
}
