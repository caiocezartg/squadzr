/**
 * Loading skeleton of the lobby capability. It is the light public entry point
 * (`features/lobby/skeleton`) used by the `/squads/[code]` loading state and by
 * the Lobby's own Suspense fallback, so the markup stays identical while the
 * Squad loads. It must stay free of page dependencies (queries, realtime, i18n):
 * the loading chunk has to remain small.
 */
export function LobbySkeleton() {
  return (
    <div
      data-testid="lobby-skeleton"
      className="flex flex-col gap-5 px-4 pt-6.5 pb-12 sm:px-6 lg:px-10"
    >
      <div className="bg-card h-11 w-44 animate-pulse" />
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="bg-card aspect-video animate-pulse lg:aspect-3/4 lg:w-72 xl:w-95" />
        <div className="bg-panel h-80 flex-1 animate-pulse" />
      </div>
    </div>
  )
}
