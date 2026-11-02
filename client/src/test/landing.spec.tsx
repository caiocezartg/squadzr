/**
 * The landing on the App Router (CCC-77, CCC-115). The page renders on the server: its navigation,
 * headline, copy, calls to action, the squad carousel with its first squad full, the popular games'
 * towers, "How it works", the FAQ, the closing call and the footer are in the server HTML (CCC-116,
 * CCC-117).
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionDto } from '@squadzr/schemas'
import LandingPage, { metadata } from '@/app/(landing)/page'
import { NARROW_QUERY } from '@/components/ds/use-media-query'
import { HowItWorks } from '@/components/landing/how-it-works'
import { stepAt } from '@/components/landing/how-it-works-stage'
import { PopularGames } from '@/components/landing/popular-games'
import { WIDE_QUERY } from '@/components/layout/wide-query'
import { MotionProvider } from '@/components/ui/motion-provider'
import type { PopularGame } from '@/types'
import { gameLol, popularGames } from './fixtures'
import { httpOk, onHttp } from './http-router'
import { EnglishIntlProvider } from './intl'
import { fakeSession, signInAsFakeUser } from './stubs'

// `connection()` marks a render as a request. The suite renders outside one, so the marker is a no-op here.
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }))

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LANDING_ROUTE_DIR = join(SRC_DIR, 'app/(landing)')

/** The landing as the server renders it for `session`, in the English messages the suite uses. */
async function landingHtml(session: SessionDto | null = null): Promise<string> {
  const page = await LandingPage()
  return renderToStaticMarkup(<EnglishIntlProvider session={session}>{page}</EnglishIntlProvider>)
}

/** Puts the server HTML in the document, as the browser has it before any script runs. */
async function showServerHtml(session: SessionDto | null = null): Promise<void> {
  document.body.innerHTML = await landingHtml(session)
}

/** The hero's own calls to action: the section that carries the headline. */
function hero(): HTMLElement {
  const section = screen.getByRole('heading', { level: 1 }).closest('section')
  if (!section) throw new Error('The headline is not in a section')
  return section
}

beforeEach(() => {
  onHttp('GET', '/api/games/popular', () => httpOk(popularGames))
})

afterEach(() => {
  document.body.innerHTML = ''
  cleanup()
  vi.restoreAllMocks()
})

describe('landing server HTML', () => {
  it('renders the headline and the one sentence that says what the product is for', async () => {
    await showServerHtml()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Build your squad Play tonight'
    )
    expect(
      screen.getByText(
        'No more queueing with randoms. Find the players your team is missing and get into the match now.'
      )
    ).toBeInTheDocument()
  })

  it('renders the headline without a hidden entrance state', async () => {
    const html = await landingHtml()
    const headingOpenTag = html.match(/<h1[^>]*>/)?.[0]

    expect(headingOpenTag).toBeDefined()
    expect(headingOpenTag).not.toContain('opacity')
  })

  it('has no games badge, however many games the catalog has', async () => {
    await showServerHtml()

    expect(screen.queryByText(/SQUADS OPEN NOW/)).not.toBeInTheDocument()
    expect(screen.queryByText(/42 GAMES/)).not.toBeInTheDocument()
  })

  it('renders a tower per popular game, the first one open, each linking to its squads', async () => {
    await showServerHtml()
    // The hero carousel names games of its own, so the games are read in their section.
    const games = within(document.getElementById('jogos') as HTMLElement)
    const lol = games.getByRole('link', { name: 'League of Legends, MOBA: see its squads' })
    const cs2 = games.getByRole('link', { name: 'Counter-Strike 2, Shooter: see its squads' })

    expect(games.getByRole('heading', { level: 2 })).toHaveTextContent(
      'From 2v2 to a 40-player raid.'
    )
    expect(lol).toHaveAttribute('href', '/squads?search=League%20of%20Legends')
    expect(cs2).toHaveAttribute('href', '/squads?search=Counter-Strike%202')
    expect(lol).toHaveAttribute('data-open', 'true')
    expect(cs2).toHaveAttribute('data-open', 'false')
  })

  it('renders the eight FAQ items as collapsed accordion triggers', async () => {
    await showServerHtml()
    const faq = within(document.getElementById('faq') as HTMLElement)
    const triggers = faq.getAllByRole('button')

    expect(faq.getByRole('heading', { level: 2 })).toHaveTextContent('Got questions?')
    expect(triggers).toHaveLength(8)
    expect(triggers[0]).toHaveTextContent('Is Squadzr free?')
    for (const trigger of triggers) expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('ends with the call to explore squads', async () => {
    await showServerHtml()
    const heading = screen.getByRole('heading', {
      level: 2,
      name: "There's a slot waiting for you.",
    })
    const cta = within(heading.closest('section') as HTMLElement)

    expect(cta.getByRole('link', { name: 'Explore squads' })).toHaveAttribute('href', '/squads')
  })

  it('points the navigation at the board and at the sections of the page', async () => {
    await showServerHtml()
    const nav = screen.getByRole('navigation', { name: 'Main' })

    expect(within(nav).getByRole('link', { name: 'Squads' })).toHaveAttribute('href', '/squads')
    expect(within(nav).getByRole('link', { name: 'Games' })).toHaveAttribute('href', '#jogos')
    expect(within(nav).getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '#como-funciona'
    )
    expect(within(nav).getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq')
    for (const id of ['jogos', 'como-funciona', 'faq']) {
      expect(document.getElementById(id)).toBeInTheDocument()
    }
  })

  it('offers a signed-out viewer both hero actions, and the sign-in in the nav', async () => {
    await showServerHtml(null)
    const banner = screen.getByRole('banner')

    expect(within(banner).getByRole('button', { name: 'Sign in with Discord' })).toBeInTheDocument()
    expect(within(banner).queryByRole('link', { name: 'Go to board' })).not.toBeInTheDocument()
    expect(within(hero()).getByRole('link', { name: 'Explore squads' })).toHaveAttribute(
      'href',
      '/squads'
    )
    expect(within(hero()).getByRole('link', { name: 'Create squad' })).toHaveAttribute(
      'href',
      '/squads?create=1'
    )
  })

  it('offers a signed-in viewer both hero actions, and the board in the nav', async () => {
    signInAsFakeUser()
    await showServerHtml(fakeSession())
    const banner = screen.getByRole('banner')

    expect(within(banner).getByRole('link', { name: 'Go to board' })).toHaveAttribute(
      'href',
      '/squads'
    )
    expect(screen.queryByRole('button', { name: 'Sign in with Discord' })).not.toBeInTheDocument()
    expect(within(hero()).getByRole('link', { name: 'Explore squads' })).toHaveAttribute(
      'href',
      '/squads'
    )
    expect(within(hero()).getByRole('link', { name: 'Create squad' })).toHaveAttribute(
      'href',
      '/squads?create=1'
    )
  })

  it('renders the hero carousel with its first squad full and in the centre, and no code field', async () => {
    await showServerHtml()
    const carousel = screen.getByRole('region', { name: 'Squads forming right now' })
    const centre = within(carousel).getByRole('group', {
      name: 'Premier quinta à noite, a Valorant squad: 5 of 5 players',
    })

    expect(within(centre).getByText('Full')).toBeInTheDocument()
    expect(within(carousel).getAllByRole('group')).toHaveLength(1)
    expect(
      within(carousel).getByRole('button', { name: 'Show Premier quinta à noite (Valorant)' })
    ).toHaveAttribute('aria-current', 'true')
    expect(screen.queryByLabelText('Have a code?')).not.toBeInTheDocument()
  })

  it('credits IGDB in the footer, next to the product and help links', async () => {
    await showServerHtml()
    const footer = screen.getByRole('contentinfo')
    const links = within(within(footer).getByRole('navigation', { name: 'Footer' }))

    expect(within(footer).getByRole('link', { name: 'game data by IGDB' })).toHaveAttribute(
      'href',
      'https://www.igdb.com'
    )
    expect(links.getByRole('link', { name: 'Explore squads' })).toHaveAttribute('href', '/squads')
    expect(links.getByRole('link', { name: 'Create squad' })).toHaveAttribute(
      'href',
      '/squads?create=1'
    )
    expect(links.getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '#como-funciona'
    )
    expect(links.getByRole('link', { name: 'Frequently asked questions' })).toHaveAttribute(
      'href',
      '#faq'
    )
    expect(links.getByRole('link', { name: 'Available games' })).toHaveAttribute('href', '#jogos')
    expect(within(footer).getByText(/^© \d{4} Squadzr/)).toBeInTheDocument()
  })
})

describe('landing games section', () => {
  /** The open tower's timer line ends. jsdom leaves `animationName` out of the event, so it is set here. */
  function runOutTimer(tower: HTMLElement) {
    const event = createEvent.animationEnd(tower)
    Object.defineProperty(event, 'animationName', { value: 'tower-progress' })
    fireEvent(tower, event)
  }

  /** `count` games of their own, named "Game 0", "Game 1"… */
  function manyGames(count: number): PopularGame[] {
    return Array.from({ length: count }, (_, index) => ({
      ...popularGames.games[0]!,
      game: { ...gameLol, id: `game-${index}`, name: `Game ${index}` },
    }))
  }

  /** The towers of `manyGames`, in order. */
  function towers(): HTMLElement[] {
    return screen.getAllByRole('link', { name: /^Game \d+, MOBA/ })
  }

  /** The open tower's timer line, if it has one. */
  function timer(): HTMLElement | null {
    return document.querySelector('[data-timer]')
  }

  /** Answers the media queries in `matching` as matched, and every other one as not. */
  function matchOnly(...matching: string[]) {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: matching.includes(query),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList
    )
  }

  /** A mouse moving over `tower`. jsdom has no PointerEvent, so the fields are set here. */
  function moveMouseOver(tower: HTMLElement) {
    const event = createEvent.pointerMove(tower)
    Object.defineProperties(event, {
      pointerType: { value: 'mouse' },
      movementX: { value: 4 },
      movementY: { value: 0 },
    })
    fireEvent(tower, event)
  }

  /**
   * A pointer of `pointerType` coming over the row or leaving it: React reads enter and leave from
   * `pointerover` and `pointerout`. jsdom has no PointerEvent, so the type is set here.
   */
  function pointer(row: HTMLElement, move: 'over' | 'out', pointerType: 'mouse' | 'touch') {
    const event = move === 'over' ? createEvent.pointerOver(row) : createEvent.pointerOut(row)
    Object.defineProperty(event, 'pointerType', { value: pointerType })
    fireEvent(row, event)
  }

  // The suite's observer never reports; this one says the row is on screen, or not, as it observes.
  const OriginalObserver = window.IntersectionObserver
  let rowOnScreen = true
  beforeEach(() => {
    rowOnScreen = true
    window.IntersectionObserver = class {
      constructor(private readonly report: IntersectionObserverCallback) {}
      observe() {
        this.report(
          [{ isIntersecting: rowOnScreen } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        )
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    } as unknown as typeof IntersectionObserver
  })
  afterEach(() => {
    window.IntersectionObserver = OriginalObserver
  })

  function renderGames(games: readonly PopularGame[] = popularGames.games) {
    render(
      <EnglishIntlProvider>
        <PopularGames games={games} />
      </EnglishIntlProvider>
    )
    return screen.getByRole('list', { name: 'Popular games' })
  }

  /** The towers of the fixture's two games. */
  function fixtureTowers() {
    return {
      lol: screen.getByRole('link', { name: 'League of Legends, MOBA: see its squads' }),
      cs2: screen.getByRole('link', { name: 'Counter-Strike 2, Shooter: see its squads' }),
    }
  }

  it.each([
    { width: 'narrow', matching: [NARROW_QUERY, '(max-width: 1023px)'], last: 2 },
    { width: 'medium', matching: ['(max-width: 1023px)'], last: 5 },
    { width: 'wide', matching: [], last: 7 },
  ])('passes from the last tower a $width window shows back to the first', ({ matching, last }) => {
    matchOnly(...matching)
    renderGames(manyGames(9))
    const all = towers()

    act(() => all[last]!.focus())
    act(() => all[last]!.blur())
    runOutTimer(all[last]!)

    expect(all[0]).toHaveAttribute('data-open', 'true')
  })

  it('hides each tower at the widths that do not count it', () => {
    renderGames(manyGames(9))
    const slots = towers().map((tower) => tower.parentElement as HTMLElement)

    for (const slot of slots.slice(0, 3)) expect(slot.className).not.toMatch(/hidden/)
    for (const slot of slots.slice(3, 6)) expect(slot).toHaveClass('max-sm:hidden')
    for (const slot of slots.slice(6, 8)) expect(slot).toHaveClass('max-lg:hidden')
    expect(slots[8]).toHaveClass('hidden')
  })

  it('holds the timer while a mouse is over the row, and not after a touch', () => {
    const row = renderGames()
    expect(timer()).toHaveStyle({ animationPlayState: 'running' })

    pointer(row, 'over', 'touch')
    expect(timer()).toHaveStyle({ animationPlayState: 'running' })

    pointer(row, 'over', 'mouse')
    expect(timer()).toHaveStyle({ animationPlayState: 'paused' })

    pointer(row, 'out', 'mouse')
    expect(timer()).toHaveStyle({ animationPlayState: 'running' })
  })

  it('holds the timer while a tower has focus, and while the row is off screen', () => {
    renderGames()
    const { cs2 } = fixtureTowers()

    act(() => cs2.focus())
    expect(timer()).toHaveStyle({ animationPlayState: 'paused' })

    act(() => cs2.blur())
    expect(timer()).toHaveStyle({ animationPlayState: 'running' })

    cleanup()
    rowOnScreen = false
    renderGames()
    expect(timer()).toHaveStyle({ animationPlayState: 'paused' })
  })

  it('opens a tower under a moving mouse only once the row has settled', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    renderGames()
    const { cs2 } = fixtureTowers()

    moveMouseOver(cs2)
    expect(cs2).toHaveAttribute('data-open', 'false')

    now.mockReturnValue(1600)
    moveMouseOver(cs2)
    expect(cs2).toHaveAttribute('data-open', 'true')
  })

  it('runs the timer line only with motion, and starts it empty until the animation fills it', () => {
    renderGames()

    // The line is empty until the animation fills it, whatever the animation's fill mode. A
    // `scale-x-0` would set `scale`, which multiplies with the keyframes' transform and hides it.
    expect(timer()).toHaveClass(
      'motion-safe:animate-tower-progress',
      'motion-reduce:hidden',
      '[transform:scaleX(0)]'
    )
    expect(timer()?.className).not.toMatch(/scale-x-/)
  })

  it('gives a lone tower no timer, as there is no other tower to pass to', () => {
    renderGames(manyGames(1))

    expect(towers()[0]).toHaveAttribute('data-open', 'true')
    expect(timer()).not.toBeInTheDocument()
  })

  it('opens the tower that takes focus', () => {
    renderGames()
    const { lol, cs2 } = fixtureTowers()

    act(() => cs2.focus())

    expect(cs2).toHaveAttribute('data-open', 'true')
    expect(lol).toHaveAttribute('data-open', 'false')
  })

  it('opens the next tower when the open one has had its time, and the first after the last', () => {
    renderGames()
    const { lol, cs2 } = fixtureTowers()

    runOutTimer(lol)
    expect(cs2).toHaveAttribute('data-open', 'true')

    runOutTimer(cs2)
    expect(lol).toHaveAttribute('data-open', 'true')
  })
})

describe('landing how it works', () => {
  const STEP_TITLES = ['Sign in with Discord', 'Find or create a squad', 'Close the team and play']
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

  /** Answers the media queries in `matching` as matched, and every other one as not. */
  function matchOnly(...matching: string[]) {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: matching.includes(query),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList
    )
  }

  function renderHowItWorks() {
    render(
      <EnglishIntlProvider>
        <MotionProvider>
          <HowItWorks />
        </MotionProvider>
      </EnglishIntlProvider>
    )
    return document.getElementById('como-funciona') as HTMLElement
  }

  /** The section's layout: the sticky stage or the stacked cards. */
  function layout(section: HTMLElement) {
    return section.querySelector('[data-layout]')?.getAttribute('data-layout')
  }

  /** The steps as the list reads them, by their titles. */
  function stepTitles(section: HTMLElement) {
    const list = within(section).getByRole('list')
    return within(list)
      .getAllByRole('listitem')
      .map((item) => within(item).getByRole('heading', { level: 3 }).textContent)
  }

  /** The mockups are decorative: every one sits under an `aria-hidden` ancestor. */
  function expectMockupsHidden(section: HTMLElement) {
    for (const label of ['caio_cz', 'Invite unlocked', 'Premier quinta à noite']) {
      const nodes = within(section).getAllByText(label)
      for (const node of nodes) expect(node.closest('[aria-hidden="true"]')).not.toBeNull()
    }
  }

  it('renders the heading and the three steps in order in the server HTML', async () => {
    await showServerHtml()
    const section = document.getElementById('como-funciona') as HTMLElement

    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(
      'From login to a full team in 1 minute.'
    )
    expect(stepTitles(section)).toEqual(STEP_TITLES)
    expect(
      within(section).getByText(
        "Search by game, language or tag. Nothing there? Create yours with your server's invite link."
      )
    ).toBeInTheDocument()
    // The server cannot know the width, so it renders the cards, with no animated mockup in them.
    expect(layout(section)).toBe('stacked')
    expect(section.querySelector('[data-hiw-mockup]')).toBeNull()
  })

  it('renders the stacked cards with final-state mockups under reduced motion, even when wide', () => {
    matchOnly(WIDE_QUERY, REDUCED_MOTION_QUERY)
    const section = renderHowItWorks()

    expect(layout(section)).toBe('stacked')
    expect(stepTitles(section)).toEqual(STEP_TITLES)
    // The final state: signed in, the squad found and picked, the invite unlocked.
    expect(within(section).getByText('caio_cz')).toBeInTheDocument()
    expect(within(section).getAllByText('Premier quinta à noite')).toHaveLength(1)
    expect(within(section).getByText('Invite unlocked')).toBeInTheDocument()
    expect(section.querySelector('[data-hiw-mockup]')).toBeNull()
    expectMockupsHidden(section)
  })

  it('renders the stacked cards with final-state mockups below 1024px', () => {
    matchOnly()
    const section = renderHowItWorks()

    expect(layout(section)).toBe('stacked')
    expect(stepTitles(section)).toEqual(STEP_TITLES)
    expect(within(section).getByText('Invite unlocked')).toBeInTheDocument()
    expect(section.querySelector('[data-hiw-mockup]')).toBeNull()
  })

  it('pins the steps in a sticky stage at wide widths, the first step active and none hidden', () => {
    matchOnly(WIDE_QUERY)
    const section = renderHowItWorks()
    const items = within(within(section).getByRole('list')).getAllByRole('listitem')
    const mockups = section.querySelectorAll('[data-hiw-mockup]')

    expect(layout(section)).toBe('sticky')
    expect(stepTitles(section)).toEqual(STEP_TITLES)
    expect(items.map((item) => item.hasAttribute('data-active'))).toEqual([true, false, false])
    expect(mockups).toHaveLength(3)
    expect([...mockups].map((mockup) => mockup.hasAttribute('data-active'))).toEqual([
      true,
      false,
      false,
    ])
    // Nothing has played before the stage is on screen.
    expect(section.querySelector('[data-play]')).toBeNull()
    for (const item of items) expect(item.closest('[aria-hidden="true"]')).toBeNull()
    expectMockupsHidden(section)
  })

  it.each([
    { progress: 0, step: 0 },
    { progress: 0.33, step: 0 },
    { progress: 0.34, step: 1 },
    { progress: 0.66, step: 1 },
    { progress: 0.67, step: 2 },
    { progress: 1, step: 2 },
  ])('makes step $step active at $progress of the track', ({ progress, step }) => {
    expect(stepAt(progress)).toBe(step)
  })
})

describe('landing page', () => {
  it('has its own title, with the app name', () => {
    expect(metadata.title).toBe('Squadzr — Find your gaming squad')
  })

  it('has no route-level loading state, so a cached landing never flashes a skeleton', () => {
    // A loading.tsx at the app root would wrap every segment, and one over the landing would cover
    // the content on every client navigation even when its data is already cached.
    expect(existsSync(join(SRC_DIR, 'app/loading.tsx'))).toBe(false)
    expect(existsSync(join(LANDING_ROUTE_DIR, 'loading.tsx'))).toBe(false)
  })
})
