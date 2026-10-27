import { useTranslations } from 'next-intl'
import { useSquadBoardSquads } from './use-squad-board-data'

interface SquadCountProps {
  /** The list's update count when the board mounted (see `useSquadBoardBaseline`). */
  readonly baseline: number
}

/** The open-squad count under the board's title, with the live dot. It reads the unfiltered list. */
export function SquadCount({ baseline }: SquadCountProps) {
  const t = useTranslations('ds.board')
  const squads = useSquadBoardSquads(baseline)

  return (
    <p className="font-ds-mono text-text-3 inline-flex items-center gap-2.25 text-xs font-bold tracking-[0.06em] uppercase">
      <span
        aria-hidden="true"
        className="bg-mint size-1.75 rounded-full motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]"
      />
      {t('openCount', { count: squads.length })}
    </p>
  )
}
