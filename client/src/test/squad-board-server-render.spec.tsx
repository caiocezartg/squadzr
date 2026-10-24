/**
 * The Squad Board's server render (CCC-79). The page renders the list the server read for the viewer,
 * so the HTML the server sends already shows the viewer's squads as joined, with no join action on them.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { SquadBoardPage } from '@/features/squad-board/page'
import { memberSquad } from './fixtures'
import { createTestQueryClient } from './harness'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import { fakeSession, signInAsFakeUser } from './stubs'

describe('squad board — server render', () => {
  it("shows the viewer's squads as joined, with no join action on them", () => {
    signInAsFakeUser()
    createHarnessNavigation('/squads')
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['squads'], { rooms: [memberSquad] })

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <EnglishIntlProvider session={fakeSession()}>
          <SquadBoardPage />
        </EnglishIntlProvider>
      </QueryClientProvider>
    )

    expect(markup).toContain(memberSquad.name)
    expect(markup).toContain('Joined')
    expect(markup).not.toContain('JOIN SQUAD')
  })
})
