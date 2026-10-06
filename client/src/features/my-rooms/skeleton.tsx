/**
 * Loading skeleton of the My squads capability. It is the light public entry
 * point (`features/my-rooms/skeleton`) used as the `/rooms/my` route
 * `pendingComponent`, so the markup stays identical while the route chunk and
 * then the page data load. It must stay free of page dependencies (queries,
 * session, i18n): the route definition chunk has to remain small.
 */
export function MyRoomsSkeleton() {
  return (
    <div data-testid="my-rooms-skeleton" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card h-64 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
