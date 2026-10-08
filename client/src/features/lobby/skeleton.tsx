/**
 * Loading skeleton of the lobby capability. It is the light public entry point
 * (`features/lobby/skeleton`) used as the `/rooms/$code` route
 * `pendingComponent`, so the markup stays identical while the route chunk and
 * then the page data load. It must stay free of page dependencies (queries,
 * realtime, i18n): the route definition chunk has to remain small.
 */
export function LobbySkeleton() {
  return (
    <div data-testid="lobby-skeleton" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="card h-48 animate-pulse mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-16 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
