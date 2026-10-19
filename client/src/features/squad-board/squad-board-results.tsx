import { lazy, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from '@/hooks/use-session'
import { useGamesMap, useSuspenseGames } from '@/features/games'
import { SquadCard, querySquadList, type SquadListQuery } from '@/features/squad-list'
import type { SquadJoining } from '@/features/squad-joining'
import { Pagination } from '@/components/ui/pagination'
import { LazyIslandBoundary } from '@/components/ui/lazy-island-boundary'
import { ModalLoading } from '@/components/ui/modal-loading'
import { notifyError } from '@/lib/notify'
import { EmptyState } from './components/empty-state'
import { useSquadBoardSquads } from './use-squad-board-data'

// Squad creation (the form contract, resolvers and dialog primitives) is a
// non-essential capability: its chunk loads when the user opens the dialog.
const LazyCreateSquadModal = lazy(() =>
  import('./create-squad-dialog').then((module) => ({ default: module.CreateSquadDialog }))
)

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
          <div id="squads-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageSquads.map((squad) => (
              <SquadCard
                key={squad.id}
                squad={squad}
                game={gamesMap.get(squad.gameId)}
                onJoin={() => joining.requestJoin(squad)}
                isLoading={!squad.isMember && joining.joiningSquadCode === squad.code}
              />
            ))}
          </div>

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
        <LazyIslandBoundary
          fallback={null}
          onError={() => notifyError(t('errors.DIALOG_LOAD_FAILED'))}
        >
          <Suspense fallback={<ModalLoading />}>
            <LazyCreateSquadModal
              games={games}
              open={createOpen}
              onOpenChange={onCreateOpenChange}
            />
          </Suspense>
        </LazyIslandBoundary>
      )}
    </>
  )
}
