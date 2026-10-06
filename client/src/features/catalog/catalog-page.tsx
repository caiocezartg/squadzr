import { lazy, Suspense, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '@/lib/auth-client'
import { WS_URL } from '@/env'
import { useWebSocket } from '@/hooks/use-websocket'
import { useNotificationEvents } from '@/hooks/use-notification-events'
import { RoomCard, RoomFilters, useRoomFilters } from '@/features/room-list'
import { useRoomJoining } from '@/features/room-joining'
import { Pagination } from '@/components/ui/pagination'
import { AlertBox } from '@/components/ui/alert-box'
import { ModalLoading } from '@/components/ui/modal-loading'
import { Plus } from 'lucide-react'
import type { Game } from '@/types'
import { EmptyState } from './components/empty-state'
import { useCatalogData } from './use-catalog-data'
import { useCatalogEvents } from './use-catalog-events'
import { usePagination } from './use-pagination'

// Room creation (the form contract, resolvers and dialog primitives) is a
// non-essential capability: its chunk loads when the user opens the dialog.
const LazyCreateRoomModal = lazy(() =>
  import('@/features/room-creation').then((module) => ({ default: module.CreateRoomModal }))
)

/**
 * The catalog page. It owns the public navigation state (filters, pagination
 * and the shared `?join=` link), the room list and the realtime subscription;
 * query keys, event names and cache mutations stay inside the capability. The
 * create and join workflows live in their own capabilities, behind this page.
 */
export function CatalogPage() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const [modalOpen, setModalOpen] = useState(false)

  // WebSocket for real-time room list updates
  const { on, subscribe } = useWebSocket({
    url: WS_URL,
    autoConnect: true,
  })

  useCatalogEvents({ subscribe })
  useNotificationEvents({ on })

  const { rooms, roomsLoading, roomsError, games, gamesLoading, gamesError } = useCatalogData()
  const joining = useRoomJoining()

  const loading = roomsLoading || gamesLoading
  const roomCount = rooms.length

  const gamesMap = useMemo(
    () => new Map<string, Game>(games.map((game) => [game.id, game])),
    [games]
  )

  const {
    localSearch,
    setLocalSearch,
    localTag,
    setLocalTag,
    filter,
    setFilter,
    sort,
    setSort,
    language,
    setLanguage,
    page,
    setPage,
    applyFilters,
  } = useRoomFilters(gamesMap)

  const filteredRooms = applyFilters(rooms)

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    hasPreviousPage,
    hasNextPage,
    goToPage,
    nextPage,
    previousPage,
    pageRange,
  } = usePagination({
    totalItems: filteredRooms.length,
    currentPage: page,
    onPageChange: setPage,
  })

  const paginatedRooms = filteredRooms.slice(startIndex, endIndex)

  const handlePageChange = (p: number) => {
    goToPage(p)
    document.getElementById('rooms-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-64 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">{t('rooms.page.title')}</h1>
          <p className="mt-1 text-sm text-muted">
            {t('rooms.page.subtitle', { count: roomCount })}
          </p>
        </div>
        {session?.user && (
          <button
            onClick={() => setModalOpen(true)}
            className="btn-accent gap-2 shrink-0 whitespace-nowrap"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t('common.createNewRoom')}</span>
            <span className="sm:hidden">{t('common.createRoom')}</span>
          </button>
        )}
      </div>

      {(roomsError || gamesError) && (
        <div className="mb-6">
          <AlertBox type="error" message={t('rooms.page.loadError')} />
        </div>
      )}

      {/* Filters */}
      <RoomFilters
        search={localSearch}
        onSearchChange={setLocalSearch}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        language={language}
        onLanguageChange={setLanguage}
        tagFilter={localTag}
        onTagFilterChange={setLocalTag}
      />

      {/* Room cards grid */}
      {filteredRooms.length === 0 ? (
        <EmptyState
          title={
            localSearch || language !== 'all' || localTag.trim()
              ? t('rooms.page.emptyTitleFiltered')
              : t('rooms.page.emptyTitle')
          }
          description={
            localSearch || language !== 'all' || localTag.trim()
              ? t('rooms.page.emptyDescriptionFiltered')
              : t('rooms.page.emptyDescription')
          }
          action={
            session?.user
              ? {
                  label: t('common.createRoom'),
                  onClick: () => setModalOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <>
          <div id="rooms-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                game={gamesMap.get(room.gameId)}
                onJoin={() => joining.requestJoin(room)}
                isLoading={!room.isMember && joining.joiningRoomCode === room.code}
                currentMembers={room.memberCount}
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

      {/* Create room modal */}
      {session?.user && modalOpen && (
        <Suspense fallback={<ModalLoading />}>
          <LazyCreateRoomModal games={games} open={modalOpen} onOpenChange={setModalOpen} />
        </Suspense>
      )}

      {joining.authPrompt}
    </div>
  )
}
