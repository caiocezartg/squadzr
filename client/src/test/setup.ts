/**
 * Global setup for the client unit/UI project.
 *
 * Contract of the suite (CCC-32): HTTP and WebSocket are isolated behind
 * deterministic adapters, auth and toasts are module mocks, and i18n is
 * pinned to English. No test reaches the network.
 */

import { afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { installHttpAdapter, resetHttpRoutes } from './http-router'
import { MockWebSocket, resetWebSocketInstances } from './ws-mock'
import { resetStubs } from './stubs'

// 1. Deterministic HTTP: must run before any import of '@/lib/api' so the
//    axios instance created there snapshots the mock adapter.
installHttpAdapter()

// 2. Deterministic WebSocket: `WebSocketClient` uses the global constructor.
vi.stubGlobal('WebSocket', MockWebSocket)

// 3. jsdom gaps that libraries probe for defensively.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
)
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
)
Element.prototype.scrollIntoView = vi.fn()
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn(async () => undefined) },
  configurable: true,
})

// 4. Session and toasts as module mocks with shared mutable state (./stubs).
vi.mock('@/lib/auth-client', async () => {
  const { authStore } = await import('./stubs')
  return {
    useSession: () => ({
      data: authStore.user
        ? { user: authStore.user, session: { userId: authStore.user.id } }
        : null,
      error: null,
      isPending: false,
    }),
    signIn: {
      social: (input: { provider?: string; callbackURL?: string }) => {
        authStore.signInSocialCalls.push(input)
        return Promise.resolve({ ok: true })
      },
    },
    signOut: async () => ({ ok: true }),
  }
})

vi.mock('sonner', async () => {
  const { toastStore } = await import('./stubs')
  return {
    toast: {
      error: (message: unknown) => {
        toastStore.errorCalls.push(message)
      },
      success: () => undefined,
      dismiss: () => undefined,
    },
    Toaster: () => null,
  }
})

// 5. i18n pinned to English so text assertions are deterministic regardless
//    of the host machine's navigator language.
import i18n from '@/lib/i18n'

void i18n.changeLanguage('en')

// 6. Per-test isolation: unmount, clear route table, sockets and stub state.
afterEach(() => {
  cleanup()
  resetHttpRoutes()
  resetWebSocketInstances()
  resetStubs()
})
