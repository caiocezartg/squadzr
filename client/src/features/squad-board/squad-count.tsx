import { useTranslations } from 'next-intl'
import { useSquadBoardSquads } from './use-squad-board-data'

interface SquadCountProps {
  /** The list's update count when the board mounted (see `useSquadBoardBaseline`). */
  readonly baseline: number
}

/** The squad count under the board's title. It reads the list the board reads, so the two agree. */
export function SquadCount({ baseline }: SquadCountProps) {
  const t = useTranslations()
  const squads = useSquadBoardSquads(baseline)

  return (
    <p className="mt-1 text-sm text-muted">{t('squads.page.subtitle', { count: squads.length })}</p>
  )
}
