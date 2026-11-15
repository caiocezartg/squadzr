import { useEffect, useState } from 'react'
import type { Player } from '@/types'

interface RosterMemory {
  /** The member ids of every roster shown so far; null until the first one has shown. */
  readonly seen: ReadonlySet<string> | null
  /** The members the latest snapshot added to what the viewer already saw. */
  readonly arrivals: ReadonlySet<string>
}

const NO_ARRIVALS: ReadonlySet<string> = new Set()

export interface RosterArrivals {
  /** A roster has already been shown, so a change from here on is a change the viewer watches. */
  readonly live: boolean
  /** Members who appeared in the latest roster. The first one has none: it is the room as it was. */
  readonly arrivals: ReadonlySet<string>
}

/**
 * Which members a roster brought in, for their entrance. The first roster shown (the member's details, or the
 * first snapshot) never animates: only a member who appears in a later one is an arrival. An arrival counts
 * only until it has rendered once, so paging away and back never replays an entrance. An empty roster
 * forgets what was seen, so the first roster of another Squad starts from the room as it was too.
 */
export function useRosterArrivals(players: readonly Player[]): RosterArrivals {
  const [memory, setMemory] = useState<RosterMemory>({ seen: null, arrivals: NO_ARRIVALS })

  // The entrance plays when the tile mounts, so once it is on screen the member is no longer an arrival.
  useEffect(() => {
    if (memory.arrivals.size > 0) setMemory((current) => ({ ...current, arrivals: NO_ARRIVALS }))
  }, [memory.arrivals])

  if (memory.seen === null) {
    if (players.length > 0) {
      setMemory({ seen: new Set(players.map((player) => player.id)), arrivals: NO_ARRIVALS })
    }
    return { live: false, arrivals: NO_ARRIVALS }
  }

  if (players.length === 0) {
    setMemory({ seen: null, arrivals: NO_ARRIVALS })
    return { live: false, arrivals: NO_ARRIVALS }
  }

  const fresh = players.filter((player) => !memory.seen?.has(player.id)).map((player) => player.id)
  if (fresh.length > 0) {
    setMemory({ seen: new Set([...memory.seen, ...fresh]), arrivals: new Set(fresh) })
  }

  return { live: true, arrivals: memory.arrivals }
}
