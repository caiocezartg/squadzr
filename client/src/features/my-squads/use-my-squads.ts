import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Squad } from '@/types'
import { mergeMySquads } from './merge-my-squads'
import { mySquadsQueryKey } from './my-squads-cache'
import { readMySquads } from './my-squads-read'

/**
 * The squads the viewer hosts or joined, merged and newest first, for the sidebar. The server reads the
 * list for the first render, so a full load has it in the HTML. It reads again when the window regains
 * focus; creating, joining and leaving refresh it through `useMySquadsCommands`. The read does not
 * suspend: a visit with nothing cached lists nothing until the read lands, and a failed read leaves
 * the section without a list.
 */
export function useMySquads(): readonly Squad[] {
  const { data } = useQuery({
    queryKey: mySquadsQueryKey,
    queryFn: readMySquads,
    refetchOnWindowFocus: true,
  })

  return useMemo(() => mergeMySquads(data), [data])
}
