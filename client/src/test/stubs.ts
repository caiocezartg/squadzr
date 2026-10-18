/**
 * Mutable state shared between the vitest module mocks (see setup.ts) and the
 * individual tests. Each test file gets a fresh module graph, so this state
 * never leaks across files.
 */

import type { SessionDto } from '@squadzr/schemas'

export interface FakeSessionUser {
  id: string
  name: string
  email: string
  image: string | null
}

export const authStore = {
  user: null as FakeSessionUser | null,
  /** Arguments captured from every Discord sign-in (`signInWithDiscord`), in order. */
  signInSocialCalls: [] as Array<{ provider?: string; callbackURL?: string }>,
}

export const toastStore = {
  /** Messages passed to `toast.error`, in order. */
  errorCalls: [] as unknown[],
}

const defaultFakeUser: FakeSessionUser = {
  id: 'user-1',
  name: 'Caio',
  email: 'caio@squadzr.test',
  image: null,
}

export function signInAsFakeUser(user: Partial<FakeSessionUser> = {}): void {
  authStore.user = { ...defaultFakeUser, ...user }
}

export function signOutFakeUser(): void {
  authStore.user = null
}

/** The session the fake store describes, in the shape the session provider holds. */
export function fakeSession(): SessionDto | null {
  const user = authStore.user
  if (!user) return null

  return { user: { id: user.id, name: user.name, email: user.email, image: user.image } }
}

export function resetStubs(): void {
  authStore.user = null
  authStore.signInSocialCalls = []
  toastStore.errorCalls = []
}
