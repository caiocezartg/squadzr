'use client'

import { useTranslations } from 'next-intl'
import type { AdminSquadDto } from '@squadzr/schemas'
import { cn } from '@/lib/utils'
import { RelativeTime, SquadSlots, SquadThumb, useSquadMeta } from './squad-parts'
import type { OpenSquad } from './squads-table'

interface SquadsRowListProps {
  readonly squads: readonly AdminSquadDto[]
  readonly selectedId: string | null
  readonly onOpen: OpenSquad
}

/**
 * The Open Squads below 640px: one card per Squad, each a button that opens its side panel, with the
 * table's fields stacked under the name. Nothing scrolls sideways.
 */
export function SquadsRowList({ squads, selectedId, onOpen }: SquadsRowListProps) {
  const t = useTranslations('admin.squads')

  return (
    <ul aria-label={t('tableLabel')} className="flex flex-col gap-2">
      {squads.map((squad) => (
        <li key={squad.id}>
          <SquadCard squad={squad} selected={squad.id === selectedId} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  )
}

interface SquadCardProps {
  readonly squad: AdminSquadDto
  readonly selected: boolean
  readonly onOpen: OpenSquad
}

function SquadCard({ squad, selected, onOpen }: SquadCardProps) {
  const t = useTranslations('admin.squads')
  const meta = useSquadMeta(squad)

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => onOpen(squad, event.currentTarget)}
      className={cn(
        'bg-panel press hover-fine:bg-raised focus-visible:outline-mint flex w-full items-start gap-3 p-3.5 text-left text-[13px] font-medium shadow-[inset_0_0_0_1px_var(--color-line)] focus-visible:outline-2 focus-visible:-outline-offset-2',
        selected && 'bg-raised'
      )}
    >
      <SquadThumb url={squad.game.coverThumbUrl} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-text min-w-0 text-sm font-extrabold break-words">{squad.name}</span>
          <span className="type-code text-text-3 shrink-0">#{squad.code}</span>
        </span>
        <span className="text-muted text-xs">{meta}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <SquadSlots squad={squad} />
          <span className="text-text-2 break-words">
            {t('hostedBy', { name: squad.host.name })}
          </span>
        </span>
        <span className="text-muted flex flex-wrap gap-x-2 text-xs">
          <span>
            {t('createdLabel')} <RelativeTime at={squad.createdAt} />
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t('activityLabel')} <RelativeTime at={squad.lastActivityAt} />
          </span>
        </span>
      </span>
    </button>
  )
}
