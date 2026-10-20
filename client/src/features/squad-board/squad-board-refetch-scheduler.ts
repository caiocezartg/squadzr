/**
 * Coalesces the board refetches triggered by a burst of realtime events.
 *
 * Every event asks for a refetch, but the scheduler runs at most one: the
 * request waits for a quiet period after the last event (`debounceMs`), and a
 * burst that never goes quiet is still served once per `maxWaitMs`. The
 * maxWait clock starts with the first event of the burst and re-arms only
 * after a refetch, so the debounce cannot starve a continuous stream. The
 * scheduler is a plain factory, so its timing is testable without React.
 */

/** Quiet period after the last event before the coalesced refetch runs. */
export const SQUAD_BOARD_REFETCH_DEBOUNCE_MS = 300

/** Longest a burst of events can postpone a refetch. */
export const SQUAD_BOARD_REFETCH_MAX_WAIT_MS = 1_000

export interface BoardRefetchSchedulerOptions {
  refetch: () => void | Promise<void>
  debounceMs?: number
  maxWaitMs?: number
}

export interface BoardRefetchScheduler {
  /** Requests a refetch, replacing any refetch already waiting. */
  schedule: () => void
  /** Drops the pending refetch; used when the consumer unmounts. */
  cancel: () => void
}

export function createSquadBoardRefetchScheduler({
  refetch,
  debounceMs = SQUAD_BOARD_REFETCH_DEBOUNCE_MS,
  maxWaitMs = SQUAD_BOARD_REFETCH_MAX_WAIT_MS,
}: BoardRefetchSchedulerOptions): BoardRefetchScheduler {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimers = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (maxWaitTimer !== null) {
      clearTimeout(maxWaitTimer)
      maxWaitTimer = null
    }
  }

  const runRefetch = (): void => {
    clearTimers()
    void refetch()
  }

  return {
    schedule: () => {
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(runRefetch, debounceMs)
      if (maxWaitTimer === null) maxWaitTimer = setTimeout(runRefetch, maxWaitMs)
    },
    cancel: () => {
      clearTimers()
    },
  }
}
