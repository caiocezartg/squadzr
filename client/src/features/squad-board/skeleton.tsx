/**
 * Loading skeletons of the Squad Board. They are the light public entry point
 * (`features/squad-board/skeleton`), so the page's Suspense boundaries show them without pulling in the
 * board. The list skeleton stands where the cards go, under the title and the filters, and the count
 * skeleton where the open-squad count goes. They must stay free of page dependencies (queries,
 * realtime, i18n).
 */

/** The list's loading state: the cards' places while the board's squads are read. */
export function SquadBoardSkeleton() {
  return (
    <div data-testid="squad-board-skeleton" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-card h-44 animate-pulse lg:h-53.5" />
      ))}
    </div>
  )
}

/** The count's loading state, the height of the line it stands for, so the title does not move. */
export function SquadCountSkeleton() {
  return <div aria-hidden="true" className="bg-card h-4.5 w-40 animate-pulse" />
}
