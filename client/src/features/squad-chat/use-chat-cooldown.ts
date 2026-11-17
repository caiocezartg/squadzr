import { useCallback, useEffect, useRef, useState } from 'react'
import { CHAT } from '@squadzr/schemas'

/** How often the seconds left are redrawn while a cooldown runs. */
const TICK_MS = 250

/** The wait when the server refuses a send and does not say how long: one full window. */
export const FALLBACK_COOLDOWN_MS = CHAT.RATE_WINDOW_MS

/** A running cooldown: the composer cannot send until `endsAt`. */
export interface ChatCooldown {
  /** When the composer unlocks, in epoch milliseconds. */
  readonly endsAt: number
  /** How long the cooldown lasts in all, for a bar that drains from full to empty. */
  readonly durationMs: number
  /** Milliseconds left, redrawn every 250ms. */
  readonly remainingMs: number
  /** Whole seconds left, rounded up, so the last second reads `1`, never `0`. */
  readonly remainingSeconds: number
}

export interface ChatCooldownControl {
  /** The running cooldown, or null once it has ended: it unlocks by itself. */
  readonly cooldown: ChatCooldown | null
  /** The composer is still locked right now, whatever the last redraw showed. */
  isActive: () => boolean
  /** Counts a message the server stored; the one that fills the window starts the cooldown. */
  recordSend: () => void
  /** Starts a cooldown the server asked for. A longer one already running is kept. */
  startFor: (durationMs: number) => void
  /** Ends the cooldown and forgets the sends counted so far. */
  clear: () => void
}

interface RunningCooldown {
  readonly endsAt: number
  readonly durationMs: number
}

/**
 * The anti-spam cooldown of the composer. The client counts its own stored sends against the same limit
 * and window the server enforces, so the cooldown usually starts on the fifth message, before the server
 * has to refuse the sixth. A refusal from the server starts it too, from the wait the server gave. The
 * count uses the instant each answer arrived, a little after the server stored the message, so the
 * composer unlocks no earlier than the server would let the member send.
 */
export function useChatCooldown(): ChatCooldownControl {
  const [running, setRunning] = useState<RunningCooldown | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const runningRef = useRef<RunningCooldown | null>(null)
  const sentAtRef = useRef<number[]>([])

  const startFor = useCallback((durationMs: number) => {
    const start = Date.now()
    const endsAt = Math.max(start + durationMs, runningRef.current?.endsAt ?? 0)
    const next = { endsAt, durationMs: endsAt - start }
    runningRef.current = next
    setNow(start)
    setRunning(next)
  }, [])

  const recordSend = useCallback(() => {
    const at = Date.now()
    const recent = [...sentAtRef.current, at]
      .filter((sentAt) => at - sentAt < CHAT.RATE_WINDOW_MS)
      .slice(-CHAT.RATE_LIMIT)
    sentAtRef.current = recent
    const oldest = recent[0]
    // The oldest of the last five leaves the window `RATE_WINDOW_MS` after it was sent.
    if (recent.length >= CHAT.RATE_LIMIT && oldest !== undefined) {
      startFor(oldest + CHAT.RATE_WINDOW_MS - at)
    }
  }, [startFor])

  const clear = useCallback(() => {
    runningRef.current = null
    sentAtRef.current = []
    setRunning(null)
  }, [])

  const isActive = useCallback(() => {
    const current = runningRef.current
    return current !== null && Date.now() < current.endsAt
  }, [])

  useEffect(() => {
    if (!running) return
    const tick = setInterval(() => setNow(Date.now()), TICK_MS)
    const unlock = setTimeout(
      () => {
        runningRef.current = null
        setRunning(null)
      },
      Math.max(0, running.endsAt - Date.now())
    )
    return () => {
      clearInterval(tick)
      clearTimeout(unlock)
    }
  }, [running])

  const remainingMs = running ? Math.max(0, running.endsAt - now) : 0
  const cooldown: ChatCooldown | null =
    running && remainingMs > 0
      ? {
          endsAt: running.endsAt,
          durationMs: running.durationMs,
          remainingMs,
          remainingSeconds: Math.ceil(remainingMs / 1000),
        }
      : null

  return { cooldown, isActive, recordSend, startFor, clear }
}
