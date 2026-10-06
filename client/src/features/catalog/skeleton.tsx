/**
 * Loading skeleton of the catalog capability. It is the light public entry
 * point (`features/catalog/skeleton`) used as the `/rooms/` route
 * `pendingComponent`, so the markup stays identical while the route chunk and
 * then the page data load. It must stay free of page dependencies (queries,
 * realtime, i18n): the route definition chunk has to remain small.
 */
export function CatalogSkeleton() {
  return (
    <div data-testid="catalog-skeleton" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card h-64 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
