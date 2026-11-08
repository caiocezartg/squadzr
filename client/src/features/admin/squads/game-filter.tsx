'use client'

import { useState, type ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Popover } from '@/components/ds/popover'
import { cn } from '@/lib/utils'
import { GameFilterOptions, type GamePick } from './game-filter-options'

interface GameFilterProps {
  /** The Game the URL keeps; empty is every Game. */
  readonly gameId: string
  /**
   * The kept Game's name when the page knows it without a pick (the first row's Game), for a filter
   * the URL brought.
   */
  readonly knownName: string | null
  readonly onChange: (gameId: string) => void
}

/**
 * The toolbar's "Game: …" chip and the panel it opens (a bottom sheet below 640px) to keep one Game or
 * every Game. The chip names the kept Game: the one picked here, else the name the page knows, else a
 * generic "1 game".
 */
export function GameFilter({ gameId, knownName, onChange }: GameFilterProps) {
  const t = useTranslations('admin.squads.gameFilter')
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<GamePick>(null)
  const name = gameId === '' ? t('chipAll') : picked?.id === gameId ? picked.name : knownName

  const pick = (game: GamePick) => {
    setPicked(game)
    setOpen(false)
    onChange(game?.id ?? '')
  }

  return (
    <Popover
      title={t('title')}
      hideTitle
      bottomSheet
      align="end"
      open={open}
      onOpenChange={setOpen}
      className="p-4 sm:w-90 sm:max-w-[calc(100vw-2rem)]"
      trigger={
        <GameFilterChip
          open={open}
          active={gameId !== ''}
          label={t('chip', { game: name ?? t('oneGame') })}
        />
      }
    >
      <GameFilterOptions gameId={gameId} onPick={pick} />
    </Popover>
  )
}

/** The popover hands its trigger behaviour to this element, so it spreads what it is given onto the button. */
function GameFilterChip({
  open,
  active,
  label,
  ...triggerProps
}: ComponentProps<'button'> & {
  readonly open: boolean
  readonly active: boolean
  readonly label: string
}) {
  return (
    <button
      type="button"
      {...triggerProps}
      className={cn(
        'press focus-visible:outline-mint font-body inline-flex min-h-13.5 max-w-full shrink-0 items-center gap-2 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2',
        open
          ? 'bg-text text-bg'
          : active
            ? 'bg-raised-2 text-mint hover-fine:bg-track'
            : 'bg-raised-2 text-text hover-fine:bg-track'
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />
    </button>
  )
}
