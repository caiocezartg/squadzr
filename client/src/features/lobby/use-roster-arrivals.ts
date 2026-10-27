import { useEffect, useState } from 'react'
import type { Player } from '@/types'

interface RosterMemory {
  /** The member ids of every snapshot so far; null until the first snapshot has arrived. */
  readonly seen: ReadonlySet<string> | null
  /** The members the latest snapshot added to what the viewer already saw. */
  readonly arrivals: ReadonlySet<string>
}

const NO_ARRIVALS: ReadonlySet<string> = new Set()

export interface RosterArrivals {
  /** A snapshot has already been shown, so a change from here on is a change the viewer watches. */
  readonly live: boolean
  /** Members who appeared in the latest snapshot. The first snapshot has none: it is the room as it was. */
  readonly arrivals: ReadonlySet<string>
}

/**
 * Which members a snapshot brought in, for their entrance. A member keeps counting as an arrival until a later snapshot adds another, which is harmless: only a tile that
 * mounts reads it. The roster is empty until the first snapshot,
 * and that one never animates: only a member who appears in a later snapshot is an arrival.
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

  const fresh = players.filter((player) => !memory.seen?.has(player.id)).map((player) => player.id)
  if (fresh.length > 0) {
    setMemory({ seen: new Set([...memory.seen, ...fresh]), arrivals: new Set(fresh) })
  }

  return { live: true, arrivals: memory.arrivals }
}
