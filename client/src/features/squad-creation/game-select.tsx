'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Game } from '@/types'
import { searchGames } from './search-games'
import { useDebouncedValue } from './use-debounced-value'

/** How long the player's typing settles before the search asks the server. */
const SEARCH_DEBOUNCE_MS = 250

/** How long the list takes to fade and shrink away before it unmounts. */
const LIST_CLOSE_MS = 150

/** Stable empty list, so the combobox keeps one items reference while it loads. */
const NO_GAMES: Game[] = []

export interface GameSelectProps {
  /** The id of the input, so the form's label names it. */
  id: string
  /** The game the form currently holds, kept after the search results change. */
  selectedGame: Game | null
  onSelect: (game: Game | null) => void
  /**
   * Tells the dialog whether the list is open. The dialog needs it to cancel its
   * own Escape dismissal while the list is open, so the first Escape reaches the
   * list without depending on event propagation (see CreateSquadModal).
   */
  onListOpenChange: (isOpen: boolean) => void
  hasError: boolean
}

/**
 * The game picker of the create-Squad form: an ARIA combobox backed by
 * `GET /api/games`. It lists each match with its player range; the input owns
 * the keyboard (arrows, Enter, Escape) and a live region announces how many
 * results the search found, so screen readers hear the same choices a sighted
 * player sees. The dialog no longer loads the catalog: the search reads only
 * what the player needs.
 *
 * It is intentionally local instead of a full combobox library: the create
 * dialog is in `/squads`' initial JavaScript, and the library's popup and
 * floating-focus machinery took that route over its bundle budget.
 */
export function GameSelect({
  id,
  selectedGame,
  onSelect,
  onListOpenChange,
  hasError,
}: GameSelectProps) {
  const t = useTranslations()
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // The list stays mounted for one short transition after it closes.
  const [closing, setClosing] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const listMounted = open || closing

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
    queryFn: ({ signal }) => searchGames(debouncedTerm, signal),
    // The player keeps reading the previous results while the next term loads;
    // TanStack Query cancels the superseded request once its query loses this
    // observer, so a term the player moved past no longer costs a response.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
  const games = gamesQuery.data ?? NO_GAMES

  // The live region and the chevron follow the fetch, but the list only shows
  // the searching state when it has nothing to list yet.
  const showsSearching = games.length === 0 && gamesQuery.isFetching
  const showsEmpty = games.length === 0 && !gamesQuery.isFetching && !gamesQuery.isPlaceholderData

  // The live region follows the same settled/placeholder rule as the empty
  // copy, so an empty placeholder is never announced as "No games found".
  const statusMessage = gamesQuery.isFetching
    ? t('squads.createModal.searchingGames')
    : showsEmpty
      ? t('squads.createModal.noGamesFound')
      : games.length > 0
        ? t('squads.createModal.gamesFound', { count: games.length })
        : ''

  // A new result set starts with nothing highlighted; the first ArrowDown picks it.
  useEffect(() => {
    setActiveIndex(-1)
  }, [games])

  // The dialog cancels its Escape dismissal while this list is open.
  useEffect(() => {
    onListOpenChange(open)
  }, [onListOpenChange, open])

  // Unmount the list once its close transition has played.
  useEffect(() => {
    if (!closing) return

    const timeout = window.setTimeout(() => setClosing(false), LIST_CLOSE_MS)
    return () => window.clearTimeout(timeout)
  }, [closing])

  // Close the list when the player clicks anywhere outside the picker.
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return
      setOpen(false)
      setClosing(true)
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

  const openList = () => {
    setClosing(false)
    setOpen(true)
  }

  const closeList = () => {
    if (!open) return
    setOpen(false)
    setClosing(true)
  }

  const selectGame = (game: Game) => {
    setQuery(labelOf(game))
    setActiveIndex(-1)
    closeList()
    onSelect(game)
    inputRef.current?.focus()
  }

  const handleInputChange = (next: string) => {
    setQuery(next)
    setActiveIndex(-1)
    openList()
    if (selectedGame && next !== labelOf(selectedGame)) {
      onSelect(null)
    }
  }

  const handleContainerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return

    // The first Escape belongs to the open list. The dialog cancels its own
    // Escape dismissal while this list is open (CreateSquadModal), so the
    // dialog stays open without relying on event propagation.
    event.preventDefault()
    closeList()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openList()
      if (games.length > 0) {
        setActiveIndex((index) => (index < 0 ? 0 : Math.min(index + 1, games.length - 1)))
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      openList()
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
      else closeList()
      return
    }

    if (event.key === 'Tab') closeList()
  }

  const toggleList = () => {
    if (open) closeList()
    else openList()
    inputRef.current?.focus()
  }

  const optionId = (index: number) => `${listboxId}-option-${index}`

  return (
    <div ref={containerRef} onKeyDown={handleContainerKeyDown} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listMounted ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-invalid={hasError || undefined}
        autoComplete="off"
        placeholder={t('squads.createModal.selectGame')}
        value={query}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={openList}
        onClick={openList}
        onKeyDown={handleInputKeyDown}
        className={`flex h-11 w-full rounded-lg border bg-surface px-4 pr-10 text-sm text-offwhite transition-colors duration-200 placeholder:text-muted/60 focus:outline-hidden focus:ring-1 ${
          hasError
            ? 'border-danger/50 focus:border-danger/70 focus:ring-danger/20'
            : 'border-border-light hover:border-muted/30 focus:border-accent/50 focus:ring-accent/20'
        }`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={
          open ? t('squads.createModal.hideGameList') : t('squads.createModal.showGameList')
        }
        aria-expanded={open}
        aria-controls={listMounted ? listboxId : undefined}
        // The chevron is a pointer shortcut: focus stays in the combobox.
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggleList}
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

      <p role="status" aria-live="polite" className="sr-only">
        {listMounted ? statusMessage : ''}
      </p>

      {listMounted && (
        <div
          aria-hidden={closing || undefined}
          className={`absolute z-60 mt-2 w-full origin-top card shadow-2xl shadow-black/50 transition-[scale,opacity] duration-150 ease-out starting:scale-95 starting:opacity-0 ${
            closing ? 'pointer-events-none scale-95 opacity-0' : 'scale-100 opacity-100'
          }`}
        >
          <ul
            id={listboxId}
            role="listbox"
            aria-label={t('squads.createModal.selectGame')}
            className={games.length === 0 ? undefined : 'max-h-72 overflow-y-auto py-1'}
          >
            {games.map((game, index) => {
              const selected = selectedGame?.id === game.id
              return (
                <li
                  key={game.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectGame(game)}
                  className={`grid cursor-default scroll-my-1 grid-cols-[1rem_1fr] items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    index === activeIndex
                      ? 'bg-surface-hover text-accent'
                      : 'text-offwhite hover:bg-surface-hover'
                  }`}
                >
                  <span className="col-start-1 flex items-center">
                    {selected && <Check className="size-3.5" aria-hidden="true" />}
                  </span>
                  <span className="col-start-2 truncate">{labelOf(game)}</span>
                </li>
              )
            })}
          </ul>
          {(showsSearching || showsEmpty) && (
            <p className="px-3 py-2.5 text-sm text-muted">
              {showsSearching
                ? t('squads.createModal.searchingGames')
                : t('squads.createModal.noGamesFound')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
