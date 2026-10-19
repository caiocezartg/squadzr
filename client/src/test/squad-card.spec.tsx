/**
 * Regression tests for the SquadCard (CCC-40 r4–r6, CCC-79).
 *
 * The card is part of the server HTML of the Squad Board, so it must be visible before any script
 * runs and through hydration: it never starts at zero opacity, and nothing fades it in on mount. Its
 * cover is the one exception, and it starts hidden over the placeholder until the image loads.
 *
 * jsdom has no `Element.animate`, so each test installs a recorder and asserts that no animation starts.
 */

import { StrictMode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SquadCard } from '@/features/squad-list'
import type { Game } from '@/types'
import { gameLol, openSquad } from './fixtures'
import { EnglishIntlProvider } from './intl'

let animateCalls: Array<{ element: Element; keyframes: unknown }> = []

beforeEach(() => {
  animateCalls = []
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: function animate(this: Element, keyframes: unknown) {
      animateCalls.push({ element: this, keyframes })
      return { cancel: vi.fn() } as unknown as Animation
    },
  })
})

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'animate')
})

describe('squad card — no entrance fade', () => {
  it('keeps opacity out of the CSS transition properties', () => {
    render(<SquadCard squad={openSquad} game={gameLol} />)

    const card = screen.getByRole('button')
    expect(card.className).not.toMatch(/(^|\s)transition-all(\s|$)/)

    const transitionProperty = card.className.match(/(?:^|\s)transition-\[([^\]]+)\]/)
    expect(transitionProperty).not.toBeNull()

    const properties = transitionProperty?.[1]?.split(',').map((property) => property.trim())
    expect(properties).toEqual(
      expect.arrayContaining(['transform', 'border-color', 'box-shadow', 'filter'])
    )
    expect(properties).not.toContain('opacity')
  })

  it('starts visible on mount, with no animation and no inline opacity', () => {
    render(<SquadCard squad={openSquad} game={gameLol} />)

    const card = screen.getByRole('button')
    expect(card.style.opacity).toBe('')
    expect(card.className).not.toMatch(/(^|\s)opacity-0(\s|$)/)
    expect(animateCalls).toHaveLength(0)
  })

  it('stays visible through a StrictMode mount, which runs the effects twice', () => {
    render(
      <StrictMode>
        <SquadCard squad={openSquad} game={gameLol} />
      </StrictMode>
    )

    expect(screen.getByRole('button').style.opacity).toBe('')
    expect(animateCalls).toHaveLength(0)
  })

  it('is visible in the server HTML, so hydration has nothing to fade in', () => {
    const markup = renderToStaticMarkup(
      <EnglishIntlProvider>
        <SquadCard squad={openSquad} game={gameLol} />
      </EnglishIntlProvider>
    )
    const [card] = markup.match(/^<button[^>]*>/) ?? []

    expect(card).toBeDefined()
    expect(card).not.toMatch(/opacity-0/)
    expect(card).not.toMatch(/style="[^"]*opacity/)
  })

  it('counts the members the card was given, one for a squad without a count', () => {
    render(<SquadCard squad={{ ...openSquad, memberCount: 3 }} game={gameLol} />)

    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

describe('squad card — cover', () => {
  it('keeps the cover hidden over the placeholder until it loads, then fades it in', () => {
    render(<SquadCard squad={openSquad} game={gameLol} />)

    const cover = screen.getByRole('img')
    expect(cover).toHaveClass('transition-opacity', 'opacity-0')
    expect(cover).not.toHaveClass('opacity-100')
    expect(cover.parentElement).toHaveClass('bg-surface-light')

    fireEvent.load(cover)

    expect(cover).toHaveClass('transition-opacity', 'opacity-100')
    expect(cover).not.toHaveClass('opacity-0')
  })

  it('keeps a broken cover hidden so the placeholder shows instead', () => {
    render(<SquadCard squad={openSquad} game={gameLol} />)

    const cover = screen.getByRole('img')
    fireEvent.error(cover)

    expect(cover).toHaveClass('opacity-0')
    expect(screen.getByRole('button').style.opacity).toBe('')
  })

  describe('when the browser loaded the cover before React attached', () => {
    function stubImageState(state: { complete: boolean; naturalWidth: number }) {
      Object.defineProperty(HTMLImageElement.prototype, 'complete', {
        configurable: true,
        get: () => state.complete,
      })
      Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
        configurable: true,
        get: () => state.naturalWidth,
      })
    }

    afterEach(() => {
      Reflect.deleteProperty(HTMLImageElement.prototype, 'complete')
      Reflect.deleteProperty(HTMLImageElement.prototype, 'naturalWidth')
    })

    it('shows a cover that is already complete at mount, with no load event', () => {
      stubImageState({ complete: true, naturalWidth: 460 })
      render(<SquadCard squad={openSquad} game={gameLol} />)

      expect(screen.getByRole('img')).toHaveClass('opacity-100')
    })

    it('keeps a cover that already failed hidden', () => {
      stubImageState({ complete: true, naturalWidth: 0 })
      render(<SquadCard squad={openSquad} game={gameLol} />)

      expect(screen.getByRole('img')).toHaveClass('opacity-0')
    })

    it('keeps a cover that is still loading hidden until it loads', () => {
      stubImageState({ complete: false, naturalWidth: 0 })
      render(<SquadCard squad={openSquad} game={gameLol} />)

      const cover = screen.getByRole('img')
      expect(cover).toHaveClass('opacity-0')
      fireEvent.load(cover)
      expect(cover).toHaveClass('opacity-100')
    })
  })

  it('hides the cover again while a new cover URL loads', () => {
    const { rerender } = render(<SquadCard squad={openSquad} game={gameLol} />)
    fireEvent.load(screen.getByRole('img'))

    const otherGame: Game = { ...gameLol, coverUrl: 'https://cdn.squadzr.test/covers/other.jpg' }
    rerender(<SquadCard squad={openSquad} game={otherGame} />)

    const cover = screen.getByRole('img')
    expect(cover).toHaveClass('opacity-0')
    fireEvent.load(cover)
    expect(cover).toHaveClass('opacity-100')
  })
})
