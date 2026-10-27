import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from '@/hooks/use-session'
import { useCreateSquadLauncher } from '@/components/layout/create-squad-launcher'
import { Pagination } from '@/components/ds/pagination'
import { SquadGrid, querySquadList, type SquadListQuery } from '@/features/squad-list'
import type { SquadJoining } from '@/features/squad-joining'
import { EmptyState } from './components/empty-state'
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
}

/**
 * The squads the board lists: the grid, its pagination and the empty state. It reads the list, so it
 * suspends until it is cached, and the page shows its title and filters in the meantime. Each card
 * renders its game from the Squad itself. Results and pages swap at once, with no transition.
 */
export function SquadBoardResults({
  baseline,
  query,
  searchActive,
  setPage,
  joining,
}: SquadBoardResultsProps) {
  const squads = useSquadBoardSquads(baseline)

  const { matching, pageSquads, currentPage, totalPages } = querySquadList(squads, query)

  // The list scrolls into view once the new page is on screen, not when it is asked for: the page
  // swaps after the click, and a scroll aimed at the old layout stops short.
  const scrollToList = useRef(false)
  useEffect(() => {
    if (!scrollToList.current) return
    scrollToList.current = false
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document
      .getElementById('squads-grid')
      ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }, [currentPage])

  const handlePageChange = (page: number) => {
    const target = Math.max(1, Math.min(page, totalPages))
    if (target === currentPage) return
    scrollToList.current = true
    setPage(target)
  }

  if (matching.length === 0) return <BoardEmptyState searchActive={searchActive} />

  return (
    <>
      <SquadGrid
        id="squads-grid"
        squads={pageSquads}
        onSelect={joining.requestJoin}
        loadingSquadCode={joining.joiningSquadCode}
      />
      <Pagination
        page={currentPage}
        pageCount={totalPages}
        onPageChange={handlePageChange}
        className="mt-2 justify-center"
      />
    </>
  )
}

/** Nothing to list: the wording names the filters when they narrow the list, and a signed-in viewer can create. */
function BoardEmptyState({ searchActive }: { readonly searchActive: boolean }) {
  const t = useTranslations()
  const session = useSession()
  const { requestCreate } = useCreateSquadLauncher()

  return (
    <EmptyState
      title={searchActive ? t('squads.page.emptyTitleFiltered') : t('squads.page.emptyTitle')}
      description={
        searchActive ? t('squads.page.emptyDescriptionFiltered') : t('squads.page.emptyDescription')
      }
      action={
        session?.user ? { label: t('common.createSquad'), onClick: requestCreate } : undefined
      }
    />
  )
}
