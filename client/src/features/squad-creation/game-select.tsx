'use client'

import { useState } from 'react'
import { Autocomplete } from '@base-ui-components/react/autocomplete'
import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown, Loader2 } from 'lucide-react'
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
 * The game picker of the create-Squad form: a search combobox backed by
 * `GET /api/games`. It lists each match with its player range, and the keyboard
 * and screen-reader behaviour comes from the Base UI combobox parts. The dialog
 * no longer loads the catalog: the search reads only what the player needs.
 */
export function GameSelect({ id, selectedGame, onSelect, hasError }: GameSelectProps) {
  const t = useTranslations()
  const [query, setQuery] = useState('')

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

  const handleInputValueChange = (next: string) => {
    // Choosing an item (pointer or Enter) fills the input with the item value,
    // which is the game id. That is the one moment the form takes the game.
    const chosen = games.find((game) => game.id === next)
    if (chosen) {
      setQuery(labelOf(chosen))
      onSelect(chosen)
      return
    }

    setQuery(next)
    if (selectedGame && next !== labelOf(selectedGame)) {
      onSelect(null)
    }
  }

  return (
    <Autocomplete.Root
      items={games}
      mode="none"
      openOnInputClick
      autoHighlight
      // The item press fills the input with the game id; the input callback
      // replaces it with the game label and records the game in the form.
      itemToStringValue={(game: Game) => game.id}
      value={query}
      onValueChange={handleInputValueChange}
    >
      <div className="relative">
        <Autocomplete.Input
          id={id}
          type="text"
          placeholder={t('squads.createModal.selectGame')}
          aria-invalid={hasError || undefined}
          className={`flex h-[44px] w-full rounded-lg border bg-surface px-4 pr-10 text-sm text-offwhite transition-colors duration-200 placeholder:text-muted/60 focus:outline-hidden focus:ring-1 ${
            hasError
              ? 'border-danger/50 focus:border-danger/70 focus:ring-danger/20'
              : 'border-border-light hover:border-muted/30 focus:border-accent/50 focus:ring-accent/20'
          } data-popup-open:border-accent/50 data-popup-open:ring-1 data-popup-open:ring-accent/20`}
        />
        <Autocomplete.Trigger
          type="button"
          aria-label={t('squads.createModal.toggleGameList')}
          className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:text-offwhite focus:outline-hidden"
        >
          {gamesQuery.isFetching ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <ChevronsUpDown className="size-3" aria-hidden="true" />
          )}
        </Autocomplete.Trigger>
      </div>

      <Autocomplete.Portal>
        <Autocomplete.Positioner className="z-60 select-none outline-hidden" sideOffset={8}>
          <Autocomplete.Popup className="w-(--anchor-width) origin-(--transform-origin) rounded-xl border border-border bg-surface shadow-2xl shadow-black/50 transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Autocomplete.Empty className="px-3 py-2.5 text-sm text-muted">
              {gamesQuery.isFetching
                ? t('squads.createModal.searchingGames')
                : t('squads.createModal.noGamesFound')}
            </Autocomplete.Empty>
            <Autocomplete.List className="max-h-(--available-height) overflow-y-auto py-1">
              {(game: Game) => (
                <Autocomplete.Item
                  key={game.id}
                  value={game}
                  className="block min-w-(--anchor-width) cursor-default scroll-my-1 truncate px-3 py-2.5 text-sm text-offwhite outline-hidden data-highlighted:bg-surface-hover data-highlighted:text-accent"
                >
                  {labelOf(game)}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  )
}
