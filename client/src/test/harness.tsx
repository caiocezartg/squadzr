/**
 * Render harness for the squad flows.
 *
 * Renders the real App Router page component for the harness location: the Squad Board at `/squads`,
 * My Squads at `/squads/my` and the Lobby at `/squads/<code>`. The location is the harness navigation,
 * which `next/navigation` and `next/link` share (see ./navigation), so a navigation swaps the page as
 * the App Router would. The tree renders with next-intl and the real English messages, inside a fresh
 * TanStack Query client so cache updates are observable through public query APIs. The realtime update
 * notice is mounted beside it, as the root layout mounts it beside the app.
 */

import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { RealtimeUpdateNotice } from '@/components/layout/realtime-update-notice'
import { LobbyPage } from '@/features/lobby'
import { MySquadsPage } from '@/features/my-squads/page'
import { SquadBoardPage } from '@/features/squad-board/page'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import type { HarnessNavigation } from './navigation'
import { fakeSession, signInAsFakeUser, signOutFakeUser } from './stubs'
import type { FakeSessionUser } from './stubs'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // The app caches query data for a minute (src/lib/query-client.ts); the
      // tests keep the same freshness so a freshly written cache entry looks
      // as fresh here as it would in production. Retries stay off so failures
      // surface deterministically.
      queries: { retry: false, staleTime: 60_000 },
      mutations: { retry: false },
    },
  })
}

/** The page the App Router renders at the harness location. */
function SquadsScene() {
  const pathname = usePathname()

  if (pathname === '/squads') return <SquadBoardPage />
  if (pathname === '/squads/my') return <MySquadsPage />

  const code = /^\/squads\/([^/]+)$/.exec(pathname)?.[1]
  if (code) return <LobbyPage squadCode={decodeURIComponent(code)} />

  return null
}

export interface SquadsFlow {
  user: UserEvent
  queryClient: QueryClient
  /** The in-memory location the Next hooks and links share, with the calls recorded on it. */
  navigation: HarnessNavigation
  /** Unmounts the tree; remount by rendering again with the same queryClient. */
  unmount: () => void
}

export interface RenderSquadsFlowOptions {
  /** `undefined` → default signed-in user; `null` → signed-out guest. */
  user?: FakeSessionUser | null
  /** Bring your own client to seed or inspect the query cache. */
  queryClient?: QueryClient
  /** Mirrors the app entry, which mounts the tree inside React.StrictMode. */
  strictMode?: boolean
}

export function renderSquadsFlow(url: string, options: RenderSquadsFlowOptions = {}): SquadsFlow {
  const queryClient = options.queryClient ?? createTestQueryClient()
  if (options.user === null) {
    signOutFakeUser()
  } else {
    signInAsFakeUser(options.user ?? {})
  }

  const navigation = createHarnessNavigation(url)

  // The session provider starts from this test's viewer, as the server's read would for this visit.
  const tree = (
    <EnglishIntlProvider session={fakeSession()}>
      <QueryClientProvider client={queryClient}>
        <SquadsScene />
        <RealtimeUpdateNotice />
      </QueryClientProvider>
    </EnglishIntlProvider>
  )

  const view = render(options.strictMode ? <StrictMode>{tree}</StrictMode> : tree)

  return {
    user: userEvent.setup({ delay: null }),
    queryClient,
    navigation,
    unmount: () => view.unmount(),
  }
}
