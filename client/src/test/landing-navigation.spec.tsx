/**
 * Links to the landing and from it (CCC-77, CCC-115). Every path that sends the player to `/` or away
 * from it goes through the Next router: the nav, the hero's calls to action and its code field.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
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

/** The observers the page created, with what each one watches, so a spec can report what they see. */
const observers: {
  callback: IntersectionObserverCallback
  targets: Element[]
  disconnected: boolean
}[] = []

class ControlledIntersectionObserver {
  private readonly record: (typeof observers)[number]

  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, targets: [], disconnected: false }
    observers.push(this.record)
  }

  observe(target: Element): void {
    this.record.targets.push(target)
  }
  unobserve(): void {}
  disconnect(): void {
    this.record.disconnected = true
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

const OriginalIntersectionObserver = globalThis.IntersectionObserver

/** Reports `target` as intersecting or not to the observer that watches it. */
function report(target: Element, isIntersecting: boolean) {
  const observer = observers.find((entry) => !entry.disconnected && entry.targets.includes(target))
  if (!observer) throw new Error('No observer watches the target')
  act(() => {
    observer.callback(
      [{ target, isIntersecting } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver
    )
  })
}

beforeEach(() => {
  globalThis.IntersectionObserver =
    ControlledIntersectionObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  globalThis.IntersectionObserver = OriginalIntersectionObserver
  observers.length = 0
  document.body.querySelectorAll('[data-test-section]').forEach((section) => {
    section.remove()
  })
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`
})

/** The page's sections the scroll-spy watches, which the nav alone does not render. */
function addSections(): Record<string, HTMLElement> {
  return Object.fromEntries(
    ['jogos', 'como-funciona', 'faq'].map((id) => {
      const section = document.createElement('section')
      section.id = id
      section.dataset.testSection = ''
      document.body.append(section)
      return [id, section]
    })
  )
}

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

    await user.click(within(nav).getByRole('link', { name: 'Squads' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads' }])
  })

  it('numbers the links like a game menu without adding the numbers to their names', () => {
    createHarnessNavigation('/')
    render(<LandingNav />)
    const nav = screen.getByRole('navigation', { name: 'Main' })

    const links = within(nav).getAllByRole('link')

    expect(links.map((link) => link.textContent)).toEqual([
      '01Squads',
      '02Games',
      '03How it works',
      '04FAQ',
    ])
    expect(within(nav).getByRole('link', { name: 'Games' })).toBeInTheDocument()
  })

  describe('the scroll-spy', () => {
    it('marks the section in view as the current location, and only one at a time', () => {
      createHarnessNavigation('/')
      const sections = addSections()
      render(<LandingNav />)
      const nav = screen.getByRole('navigation', { name: 'Main' })
      const link = (name: string) => within(nav).getByRole('link', { name })

      expect(within(nav).queryAllByRole('link', { current: 'location' })).toHaveLength(0)

      report(sections['jogos'] as Element, true)
      expect(link('Games')).toHaveAttribute('aria-current', 'location')

      report(sections['jogos'] as Element, false)
      report(sections['como-funciona'] as Element, true)
      expect(link('Games')).not.toHaveAttribute('aria-current')
      expect(link('How it works')).toHaveAttribute('aria-current', 'location')

      report(sections['como-funciona'] as Element, false)
      expect(within(nav).queryAllByRole('link', { current: 'location' })).toHaveLength(0)
    })

    it('never marks the board link, which is a route and not a section', () => {
      createHarnessNavigation('/')
      const sections = addSections()
      render(<LandingNav />)

      for (const section of Object.values(sections)) report(section, true)

      expect(screen.getByRole('link', { name: 'Squads' })).not.toHaveAttribute('aria-current')
      expect(screen.getByRole('link', { name: 'Games' })).toHaveAttribute(
        'aria-current',
        'location'
      )
    })
  })

  describe('the sticky header', () => {
    const header = () => screen.getByRole('banner')

    it('is clear at the top of the page and takes its ground once the page scrolls past the sentinel', () => {
      createHarnessNavigation('/')
      render(<LandingNav />)
      const sentinel = header().previousElementSibling as Element

      expect(header()).not.toHaveAttribute('data-stuck')

      report(sentinel, false)
      expect(header()).toHaveAttribute('data-stuck')

      report(sentinel, true)
      expect(header()).not.toHaveAttribute('data-stuck')
    })
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
    render(<HeroSection />)

    await user.click(screen.getByRole('link', { name: 'Explore squads' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads' }])
  })

  it('sends the hero call to create a squad to the board with the create dialog requested', async () => {
    const navigation = createHarnessNavigation('/')
    const user = userEvent.setup({ delay: null })
    render(<HeroSection />)

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
      render(<HeroSection />)

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
        render(<HeroSection />)

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
      render(<HeroSection />)
      await user.click(screen.getByRole('button', { name: 'Join' }))

      await user.type(screen.getByLabelText('Have a code?'), 'A')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
