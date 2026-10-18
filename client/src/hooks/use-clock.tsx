'use client'

import { useNow } from 'next-intl'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/** The relative wording only changes at minute boundaries, so the shared clock ticks once a minute. */
const CLOCK_TICK_MS = 60_000

const ClockContext = createContext<Date | undefined>(undefined)

/**
 * The one reference time for every relative time on the page. It starts at the server's request time
 * and ticks once a minute while the page stays open, so a component that mounts later reads a time at
 * most a minute behind the real one.
 */
export function ClockProvider({ children }: { readonly children: ReactNode }) {
  // Without options, `useNow` returns the request time, or the current time if there is none.
  const requestTime = useNow()
  const [now, setNow] = useState(requestTime)

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date())
    }, CLOCK_TICK_MS)
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>
}

/** The shared reference time. It can only be read below `ClockProvider`. */
export function useClock(): Date {
  const now = useContext(ClockContext)
  if (now === undefined) throw new Error('useClock must be used inside ClockProvider')
  return now
}
