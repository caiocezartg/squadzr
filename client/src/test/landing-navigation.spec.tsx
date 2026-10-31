/**
 * Links to the landing and from it (CCC-77, CCC-115). Every path that sends the player to `/` or away
 * from it goes through the Next router: the nav, the hero's calls to action and its code field.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HeroSection } from '@/components/landing/hero-section'
import { LandingNav } from '@/components/landing/landing-nav'
import { NotFound } from '@/components/ui/not-found'
import { LOCALE_COOKIE } from '@/i18n/locales'
import { createHarnessNavigation } from './navigation'
import { authStore, signInAsFakeUser } from './stubs'

function readLocaleCookie(): string | undefined {
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${LOCALE_COOKIE}=`))
  return entry?.slice(LOCALE_COOKIE.length + 1)
}

afterEach(() => {
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`
})

describe('links to the landing', () => {
  it('sends the not-found page home link to the App Router landing', async () => {
    const navigation = createHarnessNavigation('/missing')
    const user = userEvent.setup({ delay: null })
    render(<NotFound />)

    await user.click(await screen.findByRole('link', { name: 'Back to Home' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/' }])
  })
})

describe('the landing navigation', () => {
  it('links to the board and to the sections of the page', async () => {
    const navigation = createHarnessNavigation('/')
    const user = userEvent.setup({ delay: null })
    render(<LandingNav />)
    const nav = screen.getByRole('navigation', { name: 'Main' })

    expect(within(nav).getByRole('link', { name: 'Games' })).toHaveAttribute('href', '#jogos')
    expect(within(nav).getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '#como-funciona'
    )
    expect(within(nav).getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq')

    await user.click(within(nav).getByRole('link', { name: 'Explore squads' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads' }])
  })

  it('switches the language by writing the locale cookie and refreshing the route', async () => {
    const navigation = createHarnessNavigation('/')
    const user = userEvent.setup({ delay: null })
    render(<LandingNav />)

    await user.click(screen.getByRole('button', { name: 'PT' }))

    expect(readLocaleCookie()).toBe('pt-BR')
    expect(navigation.calls).toEqual([{ method: 'refresh' }])
  })

  it('signs a visitor in with Discord and returns them to the board', async () => {
    createHarnessNavigation('/')
    const user = userEvent.setup({ delay: null })
    render(<LandingNav />)

    await user.click(screen.getByRole('button', { name: 'Sign in with Discord' }))

    expect(authStore.signInSocialCalls).toEqual([
      { provider: 'discord', callbackURL: `${window.location.origin}/squads` },
    ])
  })

  it('links a signed-in viewer to the board instead of the sign-in', async () => {
    signInAsFakeUser()
    const navigation = createHarnessNavigation('/')
    const user = userEvent.setup({ delay: null })
    render(<LandingNav />)

    expect(screen.queryByRole('button', { name: 'Sign in with Discord' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Go to board' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads' }])
  })

  describe('the menu below 640px', () => {
    it('opens and closes as a disclosure that names the panel it controls', async () => {
      createHarnessNavigation('/')
      const user = userEvent.setup({ delay: null })
      render(<LandingNav />)
      const button = screen.getByRole('button', { name: 'Open menu' })
      const panel = document.getElementById(button.getAttribute('aria-controls') ?? '')

      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(panel).toContainElement(screen.getByRole('navigation', { name: 'Main' }))
      expect(panel).toContainElement(screen.getByRole('button', { name: 'Sign in with Discord' }))
      expect(panel).toContainElement(screen.getByRole('group', { name: 'Language' }))

      await user.click(button)

      expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
        'aria-expanded',
        'true'
      )

      await user.click(screen.getByRole('button', { name: 'Close menu' }))

      expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    })

    it('closes on Escape and gives the focus back to the menu button', async () => {
      createHarnessNavigation('/')
      const user = userEvent.setup({ delay: null })
      render(<LandingNav />)
      await user.click(screen.getByRole('button', { name: 'Open menu' }))
      screen.getByRole('link', { name: 'Games' }).focus()

      await user.keyboard('{Escape}')

      const button = screen.getByRole('button', { name: 'Open menu' })
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).toHaveFocus()
    })

    it('closes when a link is followed and gives the focus back to the menu button', async () => {
      createHarnessNavigation('/')
      const user = userEvent.setup({ delay: null })
      render(<LandingNav />)
      await user.click(screen.getByRole('button', { name: 'Open menu' }))

      await user.click(screen.getByRole('link', { name: 'FAQ' }))

      const button = screen.getByRole('button', { name: 'Open menu' })
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).toHaveFocus()
    })

    it('stays open when the language is switched', async () => {
      createHarnessNavigation('/')
      const user = userEvent.setup({ delay: null })
      render(<LandingNav />)
      await user.click(screen.getByRole('button', { name: 'Open menu' }))

      await user.click(screen.getByRole('button', { name: 'PT' }))

      expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
        'aria-expanded',
        'true'
      )
    })
  })
})

describe('links from the landing', () => {
  it('sends the hero call to explore squads to the Next router', async () => {
    const navigation = createHarnessNavigation('/')
    const user = userEvent.setup({ delay: null })
    render(<HeroSection gameCount={0} />)

    await user.click(screen.getByRole('link', { name: 'Explore squads' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads' }])
  })

  it('sends the hero call to create a squad to the board with the create dialog requested', async () => {
    const navigation = createHarnessNavigation('/')
    const user = userEvent.setup({ delay: null })
    render(<HeroSection gameCount={0} />)

    await user.click(screen.getByRole('link', { name: 'Create squad' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads?create=1' }])
  })

  describe('the hero code field', () => {
    it.each([
      ['abc123', '/squads?join=ABC123'],
      ['#ABC123', '/squads?join=ABC123'],
      [' a1b2c3', '/squads?join=A1B2C3'],
    ])('sends the code %j to the board invite link', async (typed, href) => {
      const navigation = createHarnessNavigation('/')
      const user = userEvent.setup({ delay: null })
      render(<HeroSection gameCount={0} />)

      await user.type(screen.getByLabelText('Have a code?'), typed)
      await user.click(screen.getByRole('button', { name: 'Join' }))

      expect(navigation.calls).toEqual([{ method: 'push', href }])
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it.each(['', 'ABC12', 'ABC1234', 'AB C12', 'ABC-12'])(
      'refuses the code %j with a message and sends no navigation',
      async (typed) => {
        const navigation = createHarnessNavigation('/')
        const user = userEvent.setup({ delay: null })
        render(<HeroSection gameCount={0} />)

        if (typed) await user.type(screen.getByLabelText('Have a code?'), typed)
        await user.click(screen.getByRole('button', { name: 'Join' }))

        expect(screen.getByRole('alert')).toHaveTextContent('A squad code has 6 letters or digits.')
        expect(screen.getByLabelText('Have a code?')).toBeInvalid()
        expect(navigation.calls).toEqual([])
      }
    )

    it('takes the message away once the viewer types again', async () => {
      createHarnessNavigation('/')
      const user = userEvent.setup({ delay: null })
      render(<HeroSection gameCount={0} />)
      await user.click(screen.getByRole('button', { name: 'Join' }))

      await user.type(screen.getByLabelText('Have a code?'), 'A')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
