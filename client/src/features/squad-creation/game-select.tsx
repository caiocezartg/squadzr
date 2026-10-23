'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Game } from '@/types'
import { searchGames } from './search-games'
import { useDebouncedValue } from './use-debounced-value'

/** How long the player's typing settles before the search asks the server. */
const SEARCH_DEBOUNCE_MS = 250

/** Stable empty list, so the combobox keeps one items reference while it loads. */
const NO_GAMES: Game[] = []

export interface GameSelectProps {
  /** The id of the input, so the form's label names it. */
  id: string
  /** The game the form currently holds, kept after the search results change. */
  selectedGame: Game | null
  onSelect: (game: Game | null) => void
  hasError: boolean
}

/**
 * The game picker of the create-Squad form: an ARIA combobox backed by
 * `GET /api/games`. It lists each match with its player range; the input owns
 * the keyboard (arrows, Enter, Escape) and the listbox announces every result,
 * so screen readers hear the same choices a sighted player sees. The dialog no
 * longer loads the catalog: the search reads only what the player needs.
 *
 * It is intentionally local instead of a full combobox library: the create
 * dialog is in `/squads`' initial JavaScript, and the library's popup and
 * floating-focus machinery took that route over its bundle budget.
 */
export function GameSelect({ id, selectedGame, onSelect, hasError }: GameSelectProps) {
  const t = useTranslations()
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const labelOf = (game: Game) =>
    t('squads.createModal.gameWithPlayers', {
      name: game.name,
      min: game.minPlayers,
      max: game.maxPlayers,
    })

  const selectedLabel = selectedGame ? labelOf(selectedGame) : ''
  // The selected label is not a query: showing the popular games under it beats
  // searching for the label the player already chose.
  const searchTerm = selectedGame && query === selectedLabel ? '' : query.trim()
  const debouncedTerm = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS)

  const gamesQuery = useQuery({
    queryKey: ['games', 'search', debouncedTerm],
    queryFn: () => searchGames(debouncedTerm),
    staleTime: 60_000,
  })
  const games = gamesQuery.data ?? NO_GAMES

  // A new result set starts with nothing highlighted; the first ArrowDown picks it.
  useEffect(() => {
    setActiveIndex(-1)
  }, [games])

  // Close the list when the player clicks anywhere outside the picker.
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  // Keep the highlighted option visible while the player moves with the keyboard.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView?.({
      block: 'nearest',
    })
  }, [activeIndex, listboxId, open])

  const selectGame = (game: Game) => {
    setQuery(labelOf(game))
    setActiveIndex(-1)
    setOpen(false)
    onSelect(game)
    inputRef.current?.focus()
  }

  const handleInputChange = (next: string) => {
    setQuery(next)
    setActiveIndex(-1)
    setOpen(true)
    if (selectedGame && next !== labelOf(selectedGame)) {
      onSelect(null)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      if (games.length > 0) {
        setActiveIndex((index) => (index < 0 ? 0 : Math.min(index + 1, games.length - 1)))
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (games.length > 0) {
        setActiveIndex((index) => (index <= 0 ? 0 : index - 1))
      }
      return
    }

    if (event.key === 'Enter') {
      const game = games[activeIndex]
      if (!open) return
      event.preventDefault()
      if (game) selectGame(game)
      else setOpen(false)
      return
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
    }

    if (event.key === 'Tab') setOpen(false)
  }

  const optionId = (index: number) => `${listboxId}-option-${index}`

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open && games.length > 0 ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-invalid={hasError || undefined}
        autoComplete="off"
        placeholder={t('squads.createModal.selectGame')}
        value={query}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={`flex h-[44px] w-full rounded-lg border bg-surface px-4 pr-10 text-sm text-offwhite transition-colors duration-200 placeholder:text-muted/60 focus:outline-hidden focus:ring-1 ${
          hasError
            ? 'border-danger/50 focus:border-danger/70 focus:ring-danger/20'
            : 'border-border-light hover:border-muted/30 focus:border-accent/50 focus:ring-accent/20'
        }`}
      />
      <button
        type="button"
        aria-label={t('squads.createModal.toggleGameList')}
        aria-expanded={open}
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
        className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:text-offwhite focus:outline-hidden"
      >
        {gamesQuery.isFetching ? (
          <span
            aria-hidden="true"
            className="size-3 animate-spin rounded-full border-2 border-muted border-t-transparent"
          />
        ) : (
          <ChevronsUpDown className="size-3" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="absolute z-60 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/50">
          {games.length === 0 ? (
            <p role="status" className="px-3 py-2.5 text-sm text-muted">
              {gamesQuery.isFetching
                ? t('squads.createModal.searchingGames')
                : t('squads.createModal.noGamesFound')}
            </p>
          ) : (
            <ul
              id={listboxId}
              role="listbox"
              aria-label={t('squads.createModal.selectGame')}
              className="max-h-72 overflow-y-auto py-1"
            >
              {games.map((game, index) => (
                <li
                  key={game.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectGame(game)}
                  className={`cursor-default scroll-my-1 truncate px-3 py-2.5 text-sm transition-colors ${
                    index === activeIndex
                      ? 'bg-surface-hover text-accent'
                      : 'text-offwhite hover:bg-surface-hover'
                  }`}
                >
                  {labelOf(game)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
