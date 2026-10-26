import type { PublicSquad } from '@/types'
import { SquadCard } from './squad-card'

export interface SquadGridProps {
  readonly squads: readonly PublicSquad[]
  /** Opens the Squad a card names, whether that joins it or opens its Lobby. */
  readonly onSelect: (squad: PublicSquad) => void
  /** The Squad whose join request is in flight, so its card shows the spinner. */
  readonly loadingSquadCode?: string | null
  readonly id?: string
}

/**
 * The grid of Squad cards shared by the Squad Board and My Squads. Both surfaces render their cards
 * through it, so a card behaves the same wherever a list appears; the pages decide what selecting a
 * card does. Each Squad carries its own game summary, so the grid reads no catalog.
 */
export function SquadGrid({ squads, onSelect, loadingSquadCode, id }: SquadGridProps) {
  return (
    <div id={id} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {squads.map((squad) => (
        <SquadCard
          key={squad.id}
          squad={squad}
          onJoin={() => onSelect(squad)}
          isLoading={!squad.isMember && loadingSquadCode === squad.code}
        />
      ))}
    </div>
  )
}
