/**
 * Mutable state shared between the vitest module mocks (see setup.ts) and the
 * individual tests. Each test file gets a fresh module graph, so this state
 * never leaks across files.
 */

export interface FakeSessionUser {
  id: string
  name: string
  email: string
  image: string | null
}

export const authStore = {
  user: null as FakeSessionUser | null,
  /** Arguments captured from every `signIn.social` call, in order. */
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

export function resetStubs(): void {
  authStore.user = null
  authStore.signInSocialCalls = []
  toastStore.errorCalls = []
}
