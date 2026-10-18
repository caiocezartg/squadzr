'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { sessionResponseSchema, type SessionDto } from '@squadzr/schemas'
import { getSession } from '@/lib/auth-client'

const SessionContext = createContext<SessionDto | null | undefined>(undefined)

/**
 * The viewer's session for the client. It starts from the server's read, so the first render already
 * knows the viewer. The browser then asks Better Auth again once after mount and whenever the window
 * regains focus. That call renews the cookie and notices a session that expired or ended in another
 * tab. A changed session updates the provider and refreshes the route, so the server renders the
 * same viewer.
 */
export function SessionProvider({
  initialSession,
  children,
}: {
  readonly initialSession: SessionDto | null
  readonly children: ReactNode
}) {
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  // The check compares against the latest session, not the one its effect was created with.
  const sessionRef = useRef(initialSession)

  useEffect(() => {
    let mounted = true
    // The mount check and a focus check can overlap, and the older one can answer last. Only the
    // latest check's answer may change the session.
    let latestCheck = 0

    async function revalidate() {
      const check = ++latestCheck
      // A failed check, a network error included, is not a signed-out viewer: the page keeps its session.
      const result = await getSession().catch(() => undefined)
      if (!mounted || check !== latestCheck || !result || result.error) return

      const parsed = sessionResponseSchema.safeParse(result.data)
      if (!parsed.success) {
        console.error('Invalid session response:', parsed.error)
        return
      }
      if (isSameSession(sessionRef.current, parsed.data)) return

      sessionRef.current = parsed.data
      setSession(parsed.data)
      router.refresh()
    }

    void revalidate()
    window.addEventListener('focus', revalidate)
    return () => {
      mounted = false
      window.removeEventListener('focus', revalidate)
    }
  }, [router])

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

/** The viewer's session, or `null` when signed out. It can only be read below `SessionProvider`. */
export function useSession(): SessionDto | null {
  const session = useContext(SessionContext)
  if (session === undefined) throw new Error('useSession must be used inside SessionProvider')
  return session
}

function isSameSession(current: SessionDto | null, next: SessionDto | null): boolean {
  if (current === null || next === null) return current === next

  return (
    current.user.id === next.user.id &&
    current.user.name === next.user.name &&
    current.user.email === next.user.email &&
    current.user.image === next.user.image
  )
}
