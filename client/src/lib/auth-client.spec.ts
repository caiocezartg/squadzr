import { describe, expect, it, vi } from 'vitest'
import { signInWithDiscord } from '@/lib/auth-client'

// The suite replaces this module for every spec (see test/setup.ts). This spec loads the real one
// on top of a stubbed Better Auth client, so the Discord sign-in call is observable.
vi.unmock('@/lib/auth-client')

const { social } = vi.hoisted(() => ({
  social: vi.fn(async (_input: unknown) => ({ ok: true })),
}))

vi.mock('better-auth/react', () => ({
  createAuthClient: () => ({ signIn: { social }, signOut: vi.fn(), getSession: vi.fn() }),
}))

describe('signInWithDiscord', () => {
  it('starts Discord sign-in and returns to the path on this origin', async () => {
    await signInWithDiscord('/squads?join=ABC123')

    expect(social).toHaveBeenCalledWith({
      provider: 'discord',
      callbackURL: `${window.location.origin}/squads?join=ABC123`,
    })
  })
})
