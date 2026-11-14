/**
 * The sign-in prompts (#162): beside every "Continue with Discord" the visitor reads that they sign in
 * on discord.com and that Squadzr never sees their password.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LandingNavAuth } from '@/components/landing/landing-nav-auth'
import { CreateSignInPrompt } from '@/components/layout/create-sign-in-prompt'
import { SquadSignIn } from '@/features/lobby/components/squad-sign-in'
import { JoinSquadAuthModal } from '@/features/squad-joining/join-squad-auth-modal'
import { EnglishIntlProvider, withEnglishIntl } from './intl'

const NOTE = 'You sign in on discord.com. Squadzr never sees your password.'
const noop = () => undefined

describe('sign-in note', () => {
  it('shows in the create prompt', async () => {
    render(<CreateSignInPrompt open onOpenChangeComplete={noop} onClose={noop} onSignIn={noop} />, {
      wrapper: withEnglishIntl(),
    })

    expect(await screen.findByText(NOTE)).toBeInTheDocument()
  })

  it('shows in the join prompt', async () => {
    render(
      <JoinSquadAuthModal
        open
        squadCode="ABC123"
        onOpenChange={noop}
        onOpenChangeComplete={noop}
        onSignIn={noop}
      />,
      { wrapper: withEnglishIntl() }
    )

    expect(await screen.findByText(NOTE)).toBeInTheDocument()
  })

  it("shows beside the landing nav's sign-in button for a visitor", () => {
    render(
      <EnglishIntlProvider session={null}>
        <LandingNavAuth />
      </EnglishIntlProvider>
    )

    expect(screen.getByRole('button', { name: 'Sign in with Discord' })).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })

  it("shows on the Lobby's sign-in screen", () => {
    render(<SquadSignIn code="ABC123" />, { wrapper: withEnglishIntl() })

    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })
})
