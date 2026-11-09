'use client'

import { useState } from 'react'
import { Gamepad2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Popover } from '@/components/ds/popover'
import { FilterChip } from './filter-chip'
import { GameFilterOptions, type GamePick } from './game-filter-options'

interface GameFilterProps {
  /** The Game the URL keeps; empty is every Game. */
  readonly gameId: string
  /**
   * The kept Game's name when the page knows it without a pick (the first row's Game, else a lookup
   * by id), for a filter the URL brought.
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
        <FilterChip
          open={open}
          active={gameId !== ''}
          label={t('chip', { game: name ?? t('oneGame') })}
          leading={<Gamepad2 aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />}
        />
      }
    >
      <GameFilterOptions gameId={gameId} onPick={pick} />
    </Popover>
  )
}
