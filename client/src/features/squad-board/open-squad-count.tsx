'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { squadBoardQueryKey } from './squad-board-cache'
import { readSquadBoard } from './squad-board-read'

/**
 * The number of squads on the board, for the shell's "All squads" link. It reads the board's own cache
 * entry (the unfiltered list), so on the board it moves with the list, and it reads again when the
 * window regains focus and when the viewer navigates to another page. The server reads the list for
 * the first render, so a full load shows the count in its HTML. A visit with nothing cached shows a
 * placeholder until the read lands, and a failed read leaves the link without a count.
 *
 * The count reads without suspending: a second suspending reader of the list next to the board's own
 * parts keeps React retrying the render while the list is pending.
 */
export function OpenSquadCount({ className }: { readonly className?: string }) {
  const pathname = usePathname()
  const { data, isPending } = useQuery({
    queryKey: squadBoardQueryKey,
    queryFn: readSquadBoard,
    refetchOnWindowFocus: true,
  })
  useRefreshOnNavigation(pathname)

  if (data) return <span className={className}>{data.rooms.length}</span>
  return isPending ? <span aria-hidden="true" className="h-3 w-5 animate-pulse bg-track" /> : null
}

/**
 * Reads the list again each time the path changes, so a count the viewer left behind does not stay
 * stale while they move around. A read already in flight is joined, not restarted: the board reads on
 * mount too.
 */
function useRefreshOnNavigation(pathname: string): void {
  const queryClient = useQueryClient()
  const lastPathname = useRef(pathname)

  useEffect(() => {
    if (lastPathname.current === pathname) return

    lastPathname.current = pathname
    void queryClient.refetchQueries(
      { queryKey: squadBoardQueryKey, exact: true, type: 'active' },
      { cancelRefetch: false }
    )
  }, [pathname, queryClient])
}
