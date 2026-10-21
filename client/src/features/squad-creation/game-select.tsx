import { Select } from '@base-ui-components/react/select'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Game } from '@/types'

export interface GameSelectProps {
  /** The id of the trigger, so the form's label names it. */
  id: string
  games: Game[]
  value: string
  onChange: (gameId: string) => void
  hasError: boolean
}

/**
 * The game picker of the create-Squad form. The trigger names the selected game with its player
 * range, and the popup lists the games the caller already loaded.
 */
export function GameSelect({ id, games, value, onChange, hasError }: GameSelectProps) {
  const t = useTranslations()
  const selectedGame = games.find((game) => game.id === value)
  const selectedLabel = selectedGame
    ? t('rooms.createModal.gameWithPlayers', {
        name: selectedGame.name,
        min: selectedGame.minPlayers,
        max: selectedGame.maxPlayers,
      })
    : null

  return (
    <Select.Root value={value || null} onValueChange={(next) => onChange(next ?? '')}>
      <Select.Trigger
        id={id}
        className={`flex h-[44px] w-full cursor-default select-none items-center justify-between rounded-lg border px-4 text-sm transition-colors duration-200 focus:outline-hidden focus:ring-1 ${
          hasError
            ? 'border-danger/50 bg-surface text-offwhite focus:border-danger/70 focus:ring-danger/20'
            : 'border-border-light bg-surface text-offwhite hover:border-muted/30 focus:border-accent/50 focus:ring-accent/20'
        } data-popup-open:border-accent/50 data-popup-open:ring-1 data-popup-open:ring-accent/20`}
      >
        <span className={`truncate ${value ? '' : 'text-muted/60'}`}>
          {selectedLabel ?? t('rooms.createModal.selectGame')}
        </span>
        <Select.Icon className="flex items-center text-muted">
          <ChevronsUpDown className="size-3" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="z-60 select-none outline-hidden" sideOffset={8}>
          <Select.Popup className="origin-(--transform-origin) rounded-xl border border-border bg-surface shadow-2xl shadow-black/50 transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Select.ScrollUpArrow className="flex h-5 w-full cursor-default items-center justify-center bg-surface text-muted" />
            <Select.List className="relative max-h-(--available-height) overflow-y-auto py-1">
              {games.map((game) => (
                <Select.Item
                  key={game.id}
                  value={game.id}
                  className="grid min-w-(--anchor-width) cursor-default select-none grid-cols-[1rem_1fr] items-center gap-2 px-3 py-2.5 text-sm text-offwhite outline-hidden data-highlighted:bg-surface-hover data-highlighted:text-accent"
                >
                  <Select.ItemIndicator className="col-start-1">
                    <Check className="size-3.5" />
                  </Select.ItemIndicator>
                  <Select.ItemText className="col-start-2">
                    {t('rooms.createModal.gameWithPlayers', {
                      name: game.name,
                      min: game.minPlayers,
                      max: game.maxPlayers,
                    })}
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
            <Select.ScrollDownArrow className="flex h-5 w-full cursor-default items-center justify-center bg-surface text-muted" />
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
