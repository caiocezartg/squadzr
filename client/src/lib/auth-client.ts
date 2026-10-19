import { createAuthClient } from 'better-auth/react'
import { env } from '@/env'

const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_API_URL,
  fetchOptions: {
    credentials: 'include',
  },
})

// The session is read through the session provider (`@/hooks/use-session`), not through a hook here.
export const { signIn, signOut, getSession } = authClient

/** Starts Discord sign-in and returns to `callbackPath` on this origin once the session is set. */
export function signInWithDiscord(callbackPath: string) {
  return signIn.social({
    provider: 'discord',
    callbackURL: `${window.location.origin}${callbackPath}`,
  })
}
