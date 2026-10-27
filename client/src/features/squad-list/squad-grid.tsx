import type { PublicSquad } from '@/types'
import { SquadCard } from './squad-card'

export interface SquadGridProps {
  readonly squads: readonly PublicSquad[]
  /** Opens the Squad a card names, whether that joins it or opens its Lobby. */
  readonly onSelect: (squad: PublicSquad) => void
  /** The Squad whose join request is in flight, so its card shows the loading state. */
  readonly loadingSquadCode?: string | null
  readonly id?: string
}

/**
 * The grid of Squad cards shared by the Squad Board and My Squads. Both surfaces render their cards
 * through it, so a card behaves the same wherever a list appears; the pages decide what selecting a
 * card does. The grid reads its own width, not the window's: it lays two cards in a row only when each
 * has room (56rem, which a 1280px window with the sidebar gives), and one wide card per row otherwise.
 * Each Squad carries its own game summary, so the grid reads no catalog.
 */
export function SquadGrid({ squads, onSelect, loadingSquadCode, id }: SquadGridProps) {
  return (
    <div id={id} className="@container scroll-mt-18 lg:scroll-mt-4">
      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
        {squads.map((squad) => (
          <SquadCard
            key={squad.id}
            squad={squad}
            onJoin={() => onSelect(squad)}
            isLoading={!squad.isMember && loadingSquadCode === squad.code}
          />
        ))}
      </div>
    </div>
  )
}
