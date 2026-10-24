/**
 * The landing on the App Router (CCC-77). The page renders on the server: its headline, copy, calls to
 * action, games badge, popular games and FAQ are in the server HTML.
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionDto } from '@squadzr/schemas'
import LandingPage, { metadata } from '@/app/(landing)/page'
import { BackgroundRipple } from '@/components/landing/background-ripple'
import { HeroSquadShowcase } from '@/components/landing/hero-squad-showcase'
import { ClockProvider } from '@/hooks/use-clock'
import en from '@/locales/en.json'
import { gameCs2, gameLol, popularGames } from './fixtures'
import { httpOk, onHttp } from './http-router'
import { EnglishIntlProvider } from './intl'
import { fakeSession, signInAsFakeUser } from './stubs'

// `connection()` marks a render as a request. The suite renders outside one, so the marker is a no-op here.
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }))

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LANDING_ROUTE_DIR = join(SRC_DIR, 'app/(landing)')
const NOW = new Date('2031-06-01T12:00:00Z')

/** The landing as the server renders it for `session`, in the English messages the suite uses. */
async function landingHtml(session: SessionDto | null = null): Promise<string> {
  const page = await LandingPage()
  return renderToStaticMarkup(<EnglishIntlProvider session={session}>{page}</EnglishIntlProvider>)
}

function rippleCells(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div[style*="cell-ripple"]'))
}

beforeEach(() => {
  onHttp('GET', '/api/games/popular', () => httpOk(popularGames))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('landing server HTML', () => {
  it('renders the headline, the copy and the calls to action', async () => {
    const html = await landingHtml()

    expect(html).toContain('STOP PLAYING')
    expect(html).toContain('get a Discord invite the second your team is ready.')
    expect(html).toContain('Explore squads')
    expect(html).toContain('Sign in with Discord')
  })

  it('renders the headline without a hidden entrance state', async () => {
    const html = await landingHtml()
    const headingOpenTag = html.match(/<h1[^>]*>/)?.[0]

    expect(headingOpenTag).toBeDefined()
    expect(headingOpenTag).not.toContain('opacity')
  })

  it('renders the total badge, the popular games and the FAQ', async () => {
    const html = await landingHtml()

    // The badge counts every Listed Game (42), not just the two returned in the page.
    expect(html).toContain('42 GAMES SUPPORTED')
    expect(html).toContain(gameLol.name)
    expect(html).toContain(gameCs2.name)
    expect(html).toContain('4 open squads')
    expect(html).toContain('No open squads')
    expect(html).toContain('#ranked')
    expect(html).toContain('#chill')
    expect(html).toContain('Is Squadzr free?')
    expect(html).toContain('game data by IGDB')
  })

  it('shows a signed-out viewer the sign-in calls to action', async () => {
    const html = await landingHtml(null)

    expect(html).toContain('Sign in with Discord')
    expect(html).toContain('Create Account')
  })

  it('leaves the sign-in calls to action out for a signed-in viewer', async () => {
    signInAsFakeUser()
    const html = await landingHtml(fakeSession())

    expect(html).not.toContain('Sign in with Discord')
    expect(html).not.toContain('Create Account')
    expect(html).toContain('Explore squads')
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

describe('hero squad showcase', () => {
  it('times its sample squads from the now that next-intl hands to the client', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en} now={NOW}>
        <ClockProvider>
          <HeroSquadShowcase />
        </ClockProvider>
      </NextIntlClientProvider>
    )

    expect(screen.getByText('8m ago')).toBeInTheDocument()
    expect(screen.getByText('3m ago')).toBeInTheDocument()
    expect(screen.getByText('15m ago')).toBeInTheDocument()
    // Each sample card reads its game from the Squad summary it carries.
    expect(screen.getByText('League of Legends')).toBeInTheDocument()
    expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument()
    expect(screen.getByText('Dota 2')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Counter-Strike 2' })).toHaveAttribute(
      'src',
      'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaczd.webp'
    )
  })
})

describe('background ripple', () => {
  it('mounts a fresh set of cells on each click, so every ripple starts over', () => {
    // A 96 px box: the grid adds a row and a column, so the click reaches a 3 x 3 set of cells.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 96,
      height: 96,
      x: 0,
      y: 0,
      right: 96,
      bottom: 96,
      toJSON: () => ({}),
    } as DOMRect)
    const { container } = render(<BackgroundRipple />)
    const ripple = container.firstElementChild as HTMLElement

    fireEvent.click(ripple, { clientX: 10, clientY: 10 })
    const firstRipple = rippleCells(container)
    expect(firstRipple).toHaveLength(9)

    fireEvent.click(ripple, { clientX: 10, clientY: 10 })

    expect(firstRipple.every((cell) => !cell.isConnected)).toBe(true)
    expect(rippleCells(container)).toHaveLength(9)
  })
})
