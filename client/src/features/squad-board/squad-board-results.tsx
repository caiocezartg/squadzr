import { useTranslations } from 'next-intl'
import { useSession } from '@/hooks/use-session'
import { useGamesMap, useSuspenseGames } from '@/features/games'
import { SquadGrid, querySquadList, type SquadListQuery } from '@/features/squad-list'
import type { SquadJoining } from '@/features/squad-joining'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from './components/empty-state'
import { CreateSquadDialog } from './create-squad-dialog'
import { useSquadBoardSquads } from './use-squad-board-data'

export interface SquadBoardResultsProps {
  /** The list's update count when the board mounted (see `useSquadBoardBaseline`). */
  readonly baseline: number
  /** The URL's search, resolved: it filters, sorts and pages the list. */
  readonly query: SquadListQuery
  /** Whether the search text, language or tag narrows the list; it picks the empty state's wording. */
  readonly searchActive: boolean
  readonly setPage: (page: number) => void
  readonly joining: SquadJoining
  /** The create dialog is opened from the page header, so its state comes from the page. */
  readonly createOpen: boolean
  readonly onCreateOpenChange: (open: boolean) => void
}

/**
 * The squads the board lists: the grid, its pagination, the empty state and the create dialog, which
 * needs the games. It reads the list and the games, so it suspends until both are cached, and the page
 * shows its title and filters in the meantime.
 */
export function SquadBoardResults({
  baseline,
  query,
  searchActive,
  setPage,
  joining,
  createOpen,
  onCreateOpenChange,
}: SquadBoardResultsProps) {
  const t = useTranslations()
  const session = useSession()
  const squads = useSquadBoardSquads(baseline)
  const games = useSuspenseGames()
  const gamesMap = useGamesMap(games)

  const { matching, pageSquads, currentPage, totalPages, hasPreviousPage, hasNextPage, pageRange } =
    querySquadList(squads, gamesMap, query)

  const goToPage = (target: number) => setPage(Math.max(1, Math.min(target, totalPages)))
  const previousPage = () => goToPage(currentPage - 1)
  const nextPage = () => goToPage(currentPage + 1)

  const handlePageChange = (p: number) => {
    goToPage(p)
    document.getElementById('squads-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {matching.length === 0 ? (
        <EmptyState
          title={searchActive ? t('squads.page.emptyTitleFiltered') : t('squads.page.emptyTitle')}
          description={
            searchActive
              ? t('squads.page.emptyDescriptionFiltered')
              : t('squads.page.emptyDescription')
          }
          action={
            session?.user
              ? {
                  label: t('common.createSquad'),
                  onClick: () => onCreateOpenChange(true),
                }
              : undefined
          }
        />
      ) : (
        <>
          <SquadGrid
            id="squads-grid"
            squads={pageSquads}
            games={gamesMap}
            onSelect={joining.requestJoin}
            loadingSquadCode={joining.joiningSquadCode}
          />

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageRange={pageRange}
            hasPreviousPage={hasPreviousPage}
            hasNextPage={hasNextPage}
            onPageChange={handlePageChange}
            onPreviousPage={previousPage}
            onNextPage={nextPage}
          />
        </>
      )}

      {/* Create squad modal */}
      {session?.user && createOpen && (
        <CreateSquadDialog games={games} open={createOpen} onOpenChange={onCreateOpenChange} />
      )}
    </>
  )
}
