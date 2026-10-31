/**
 * The hero demo (CCC-115): the slot stage locks its players in one by one, the board's squad card follows
 * the count and the Lobby's Discord panel unlocks at 5/5. It plays once, when the stage is visible, and
 * holds its final state; picking a game in the switcher plays it again, for that game. Under reduced
 * motion it is always in the final state.
 */

import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnglishIntlProvider } from '@/test/intl'
import { mockMediaQuery } from '@/test/media-query'
import { HeroDemo as HeroDemoView } from './hero-demo'
import { useDemoGames } from './use-demo-games'

/** The demo as the hero composes it: with its own game state. */
function HeroDemo() {
  const demo = useDemoGames()
  return (
    <HeroDemoView game={demo.game} games={demo.games} onPick={demo.pick} onIntent={demo.reach} />
  )
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** The observers the demo created, so a spec can report the stage entering the viewport. */
const observers: {
  callback: IntersectionObserverCallback
  disconnected: boolean
}[] = []

class ControlledIntersectionObserver {
  private readonly record: (typeof observers)[number]

  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, disconnected: false }
    observers.push(this.record)
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    this.record.disconnected = true
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

const OriginalIntersectionObserver = globalThis.IntersectionObserver

function enterViewport(intersectionRatio = 1) {
  act(() => {
    for (const observer of observers.filter((entry) => !entry.disconnected)) {
      observer.callback(
        [{ isIntersecting: true, intersectionRatio } as IntersectionObserverEntry],
        observer as unknown as IntersectionObserver
      )
    }
  })
}

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds)
  })
}

/** The slots locked in on the stage. */
function lockedSlots(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('li[data-locked]'))
}

/** How many players the board's card says the squad has, read from its accessible name. */
function cardCount(name: RegExp = /Premier quinta à noite/): string {
  const card = screen.getByRole('group', { name })
  return /(\d) of 5 players/.exec(card.getAttribute('aria-label') ?? '')?.[1] ?? ''
}

const lockedPanel = () => screen.queryByRole('heading', { name: 'Discord invite' })
const readyPanel = () => screen.queryByRole('heading', { name: "Let's go to Discord" })

beforeEach(() => {
  vi.useFakeTimers()
  globalThis.IntersectionObserver =
    ControlledIntersectionObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  vi.useRealTimers()
  globalThis.IntersectionObserver = OriginalIntersectionObserver
  observers.length = 0
  vi.restoreAllMocks()
})

describe('HeroDemo', () => {
  describe('with motion allowed', () => {
    beforeEach(() => {
      mockMediaQuery(REDUCED_MOTION_QUERY, false)
    })

    it('starts with two players locked in, three slots searching and the invite locked', () => {
      render(<HeroDemo />)

      expect(lockedSlots()).toHaveLength(2)
      expect(cardCount()).toBe('2')
      expect(lockedPanel()).toBeInTheDocument()
      expect(screen.getByText('3 slots left')).toBeInTheDocument()
      expect(readyPanel()).not.toBeInTheDocument()
    })

    it('waits until the stage is visible before it plays', () => {
      render(<HeroDemo />)

      advance(10_000)

      expect(lockedSlots()).toHaveLength(2)
      expect(cardCount()).toBe('2')
    })

    it('waits until half the stage is on screen, so the story is seen from its start', () => {
      render(<HeroDemo />)

      enterViewport(0.2)
      advance(10_000)
      expect(lockedSlots()).toHaveLength(2)

      enterViewport(0.5)
      advance(600)
      expect(lockedSlots()).toHaveLength(3)
    })

    it('locks a slot in every 900ms, 600ms after the stage is visible, and the card follows', () => {
      render(<HeroDemo />)
      enterViewport()

      advance(599)
      expect(lockedSlots()).toHaveLength(2)
      advance(1)
      expect(lockedSlots()).toHaveLength(3)
      expect(cardCount()).toBe('3')
      expect(screen.getByText('2 slots left')).toBeInTheDocument()

      advance(899)
      expect(lockedSlots()).toHaveLength(3)
      advance(1)
      expect(lockedSlots()).toHaveLength(4)
      expect(cardCount()).toBe('4')
      expect(screen.getByText('1 slot left')).toBeInTheDocument()
      expect(readyPanel()).not.toBeInTheDocument()

      advance(900)
      expect(lockedSlots()).toHaveLength(5)
      expect(cardCount()).toBe('5')
    })

    it('locks the viewer in last, and swaps the locked invite for the ready one at 5/5', () => {
      render(<HeroDemo />)
      enterViewport()

      advance(600 + 900)
      expect(document.querySelector('li[data-you]')).not.toHaveAttribute('data-locked')
      expect(lockedPanel()).toBeInTheDocument()

      advance(900)
      const you = document.querySelector('li[data-you]')
      expect(you).toHaveAttribute('data-locked')
      expect(you).toHaveTextContent('You')
      expect(lockedPanel()).not.toBeInTheDocument()
      expect(readyPanel()).toBeInTheDocument()
      expect(screen.getByText('discord.gg/')).toBeInTheDocument()
    })

    it('holds the final state and never loops or replays', () => {
      render(<HeroDemo />)
      enterViewport()
      advance(600 + 900 * 2)

      expect(lockedSlots()).toHaveLength(5)
      expect(readyPanel()).toBeInTheDocument()

      advance(60_000)
      enterViewport()
      advance(60_000)

      expect(lockedSlots()).toHaveLength(5)
      expect(cardCount()).toBe('5')
      expect(readyPanel()).toBeInTheDocument()
      expect(lockedPanel()).not.toBeInTheDocument()
    })

    it('stops its timers when the page goes away', () => {
      const { unmount } = render(<HeroDemo />)
      enterViewport()
      advance(700)

      unmount()

      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('with reduced motion', () => {
    beforeEach(() => {
      mockMediaQuery(REDUCED_MOTION_QUERY, true)
    })

    it('shows the final state and never rewinds', () => {
      render(<HeroDemo />)

      expect(lockedSlots()).toHaveLength(5)
      expect(cardCount()).toBe('5')
      expect(readyPanel()).toBeInTheDocument()
      expect(lockedPanel()).not.toBeInTheDocument()
    })

    it('does not wait for the stage or play when it becomes visible', () => {
      render(<HeroDemo />)

      enterViewport()
      advance(10_000)

      expect(observers).toHaveLength(0)
      expect(lockedSlots()).toHaveLength(5)
    })

    it('never shows the start of the story while hydrating the server markup', () => {
      const markup = renderToString(
        <EnglishIntlProvider>
          <HeroDemo />
        </EnglishIntlProvider>
      )
      const container = document.createElement('div')
      container.innerHTML = markup
      document.body.append(container)
      const changes: MutationRecord[] = []
      const watcher = new MutationObserver((records) => changes.push(...records))
      watcher.observe(container, { attributes: true, childList: true, subtree: true })

      let root: ReturnType<typeof hydrateRoot> | undefined
      act(() => {
        root = hydrateRoot(
          container,
          <EnglishIntlProvider>
            <HeroDemo />
          </EnglishIntlProvider>
        )
      })

      expect(container.querySelectorAll('li[data-locked]')).toHaveLength(5)
      expect(changes).toEqual([])
      expect(watcher.takeRecords()).toEqual([])

      act(() => root?.unmount())
      watcher.disconnect()
      container.remove()
    })
  })

  it('describes the result once, in its final state, and keeps its actions out of reach', () => {
    mockMediaQuery(REDUCED_MOTION_QUERY, false)
    render(<HeroDemo />)

    const result = screen.getByRole('img', { name: /lock in one by one/ })
    expect(result).toHaveAccessibleName(
      'Illustration: the five slots of a Valorant squad lock in one by one, and the last one is you. The squad closes at 5 of 5 and its Discord invite unlocks.'
    )
    expect(result.querySelector('[inert]')).not.toBeNull()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('lists the five slots, and the last one links to the board', () => {
    mockMediaQuery(REDUCED_MOTION_QUERY, false)
    render(<HeroDemo />)

    const stage = screen.getByRole('list', { name: 'The slots of Premier quinta à noite' })
    expect(stage.querySelectorAll('li')).toHaveLength(5)
    expect(
      screen.getByRole('link', { name: 'Your slot: explore squads and take the last spot' })
    ).toHaveAttribute('href', '/squads')
  })

  describe('the game switcher', () => {
    beforeEach(() => {
      mockMediaQuery(REDUCED_MOTION_QUERY, false)
    })

    it('offers three games, with only the selected one in the tab order', () => {
      render(<HeroDemo />)

      const tabs = screen.getAllByRole('tab')
      expect(tabs.map((tab) => tab.textContent)).toEqual(['Valorant', 'LoL', 'CS2'])
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
      expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1])
      expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Valorant')
    })

    it('swaps the squad and replays the story from its start when a game is picked', () => {
      render(<HeroDemo />)
      enterViewport()
      advance(600 + 900 * 2)
      expect(lockedSlots()).toHaveLength(5)

      fireEvent.click(screen.getByRole('tab', { name: 'LoL' }))

      expect(screen.getByRole('tab', { name: 'LoL' })).toHaveAttribute('aria-selected', 'true')
      expect(lockedSlots()).toHaveLength(2)
      expect(cardCount(/Flex de sexta, sem tilt/)).toBe('2')
      expect(screen.getByRole('img', { name: /League of Legends squad/ })).toBeInTheDocument()

      advance(600)
      expect(lockedSlots()).toHaveLength(3)
      advance(900 * 2)
      expect(lockedSlots()).toHaveLength(5)
      expect(readyPanel()).toBeInTheDocument()
      expect(screen.getByText('flex-sexta')).toBeInTheDocument()

      advance(60_000)
      expect(lockedSlots()).toHaveLength(5)
    })

    it('replays the story when the game on the stage is picked again', () => {
      render(<HeroDemo />)
      enterViewport()
      advance(600 + 900 * 2)

      fireEvent.click(screen.getByRole('tab', { name: 'Valorant' }))

      expect(lockedSlots()).toHaveLength(2)
      advance(600 + 900 * 2)
      expect(lockedSlots()).toHaveLength(5)
    })

    it('restarts a story that is still playing instead of running two at once', () => {
      render(<HeroDemo />)
      enterViewport()
      advance(600)
      expect(lockedSlots()).toHaveLength(3)

      fireEvent.click(screen.getByRole('tab', { name: 'CS2' }))
      advance(599)
      expect(lockedSlots()).toHaveLength(2)
      advance(1)
      expect(lockedSlots()).toHaveLength(3)
    })

    it('moves between the games with the arrows, Home and End, and picks the one it lands on', () => {
      render(<HeroDemo />)
      const tab = (name: string) => screen.getByRole('tab', { name })

      fireEvent.keyDown(tab('Valorant'), { key: 'ArrowRight' })
      expect(tab('LoL')).toHaveFocus()
      expect(tab('LoL')).toHaveAttribute('aria-selected', 'true')
      expect(tab('LoL').tabIndex).toBe(0)

      fireEvent.keyDown(tab('LoL'), { key: 'End' })
      expect(tab('CS2')).toHaveFocus()
      expect(cardCount(/Mix de domingo 15k\+/)).toBe('2')

      fireEvent.keyDown(tab('CS2'), { key: 'ArrowRight' })
      expect(tab('Valorant')).toHaveFocus()

      fireEvent.keyDown(tab('Valorant'), { key: 'ArrowLeft' })
      expect(tab('CS2')).toHaveFocus()

      fireEvent.keyDown(tab('CS2'), { key: 'Home' })
      expect(tab('Valorant')).toHaveAttribute('aria-selected', 'true')
    })

    it('swaps the game in its final state under reduced motion', () => {
      mockMediaQuery(REDUCED_MOTION_QUERY, true)
      render(<HeroDemo />)

      fireEvent.click(screen.getByRole('tab', { name: 'CS2' }))
      advance(10_000)

      expect(lockedSlots()).toHaveLength(5)
      expect(cardCount(/Mix de domingo 15k\+/)).toBe('5')
      expect(readyPanel()).toBeInTheDocument()
    })
  })
})
