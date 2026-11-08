'use client'

import { useTranslations } from 'next-intl'
import type { AdminSquadDto } from '@squadzr/schemas'
import { cn } from '@/lib/utils'
import { RelativeTime, SquadSlots, SquadThumb, useSquadMeta } from './squad-parts'

const HEADER_CELL = 'type-label text-faint px-3 pb-2.5 text-left whitespace-nowrap'
const CELL = 'px-3 py-3 align-middle shadow-[inset_0_1px_0_#16171b]'

/** Opens a Squad's side panel; the element is where focus returns when it closes. */
export type OpenSquad = (squad: AdminSquadDto, opener: HTMLElement) => void

interface SquadsListProps {
  readonly squads: readonly AdminSquadDto[]
  /** The Squad whose panel is open, marked in the list. */
  readonly selectedId: string | null
  readonly onOpen: OpenSquad
}

/**
 * The Open Squads as a table, from 640px up: poster, name and "Game · Platform", code, host, slots,
 * created and last activity. The name is the row's button, and it covers the whole row, so a click
 * anywhere opens the Squad's side panel.
 */
export function SquadsTable({ squads, selectedId, onOpen }: SquadsListProps) {
  const t = useTranslations('admin.squads')

  return (
    <table className="w-full border-collapse text-[13.5px] font-medium">
      <caption className="sr-only">{t('tableLabel')}</caption>
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.squad')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.code')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.host')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.slots')}
          </th>
          <th scope="col" className={`${HEADER_CELL} max-md:hidden`}>
            {t('columns.created')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.lastActivity')}
          </th>
        </tr>
      </thead>
      <tbody className="text-text-2">
        {squads.map((squad) => (
          <SquadsTableRow
            key={squad.id}
            squad={squad}
            selected={squad.id === selectedId}
            onOpen={onOpen}
          />
        ))}
      </tbody>
    </table>
  )
}

interface SquadsTableRowProps {
  readonly squad: AdminSquadDto
  readonly selected: boolean
  readonly onOpen: OpenSquad
}

function SquadsTableRow({ squad, selected, onOpen }: SquadsTableRowProps) {
  const meta = useSquadMeta(squad)

  return (
    <tr className={cn('hover-fine:bg-raised relative h-11', selected && 'bg-raised')}>
      <td className={CELL}>
        <span className="flex items-center gap-2.5">
          <SquadThumb url={squad.game.coverThumbUrl} />
          <span className="flex min-w-0 flex-col">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={(event) => onOpen(squad, event.currentTarget)}
              className="text-text focus-visible:outline-mint text-left font-bold break-words after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {squad.name}
            </button>
            <span className="text-muted text-xs">{meta}</span>
          </span>
        </span>
      </td>
      <td className={`${CELL} type-code text-text-2 whitespace-nowrap`}>#{squad.code}</td>
      <td className={CELL}>
        <span className="break-words">{squad.host.name}</span>
      </td>
      <td className={CELL}>
        <SquadSlots squad={squad} />
      </td>
      <td className={`${CELL} text-muted max-md:hidden`}>
        <RelativeTime at={squad.createdAt} />
      </td>
      <td className={`${CELL} text-muted`}>
        <RelativeTime at={squad.lastActivityAt} />
      </td>
    </tr>
  )
}
