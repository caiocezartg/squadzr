/**
 * Global setup for the client unit/UI project.
 *
 * Contract of the suite (CCC-32): HTTP and WebSocket are isolated behind
 * deterministic adapters, auth and toasts are module mocks, and the messages
 * are pinned to English. The Next navigation modules share the harness location.
 * No test reaches the network.
 */

import type { ReactElement } from 'react'
import { afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import type * as TestingLibrary from '@testing-library/react'
import { installHttpFetch, resetHttpRoutes } from './http-router'
import { MockWebSocket, resetWebSocketInstances } from './ws-mock'
import { resetStubs } from './stubs'
import { resetHarnessNavigation } from './navigation'

// 1. Deterministic HTTP: `@/lib/api` calls the global `fetch` for each request, which answers from
//    the route table.
installHttpFetch()

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

// 4. Auth and toasts as module mocks with shared mutable state (./stubs). The browser's session
//    check answers from the same store the session provider is seeded from.
vi.mock('@/lib/auth-client', async () => {
  const { authStore } = await import('./stubs')
  return {
    getSession: vi.fn(async () => ({
      data: authStore.user ? { user: authStore.user, session: { id: 'session-1' } } : null,
      error: null,
    })),
    signInWithDiscord: (callbackPath: string) => {
      authStore.signInSocialCalls.push({
        provider: 'discord',
        callbackURL: window.location.origin + callbackPath,
      })
      return Promise.resolve({ ok: true })
    },
    // Better Auth ends the session on the server, so the next session check answers signed out.
    signOut: async () => {
      authStore.user = null
      return { ok: true }
    },
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

// 5. Messages pinned to English: every render gets the English provider, as the
//    app root provides it, so a spec needs no wrapper of its own.
vi.mock('@testing-library/react', async (importOriginal) => {
  const testing = await importOriginal<typeof TestingLibrary>()
  const { withEnglishIntl } = await import('./intl')
  return {
    ...testing,
    render: (ui: ReactElement, options: Parameters<typeof testing.render>[1] = {}) =>
      testing.render(ui, { ...options, wrapper: withEnglishIntl(options.wrapper) }),
  }
})

// 6. next/navigation and next/link read and write the harness location (./navigation).
vi.mock('next/navigation', async () => (await import('./navigation')).nextNavigationMock)
vi.mock('next/link', async () => (await import('./navigation')).nextLinkMock)

// 7. Per-test isolation: unmount, clear route table, sockets, stub state and the location.
afterEach(() => {
  cleanup()
  resetHttpRoutes()
  resetWebSocketInstances()
  resetStubs()
  resetHarnessNavigation()
})

// 8. Server-only modules (the server env and the Next server API) are imported by specs. The real
//    guard throws outside a React Server Component, so the suite replaces it with an empty module.
vi.mock('server-only', () => ({}))
