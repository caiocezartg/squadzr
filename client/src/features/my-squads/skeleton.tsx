/**
 * Loading skeleton of the My Squads capability. It is the light public entry point
 * (`features/my-squads/skeleton`) used by the `/squads/my` loading UI and by the page's own
 * Suspense boundary, so the markup stays identical while the route chunk and then the list load.
 * It must stay free of page dependencies (queries, session, i18n): the loading chunk has to
 * remain small.
 */
export function MySquadsSkeleton() {
  return (
    <div data-testid="my-squads-skeleton" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card h-64 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
