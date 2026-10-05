import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createRoomResponseSchema } from '@squadzr/schemas'
import { signIn, useSession } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
import { WS_URL } from '@/env'
import { useWebSocket } from '@/hooks/use-websocket'
import { useNotificationEvents } from '@/hooks/use-notification-events'
import { useRoomFilters } from '@/hooks/use-room-filters'
import { RoomCard } from '@/components/rooms/room-card'
import { RoomFilters } from '@/components/rooms/room-filters'
import { CreateRoomModal } from '@/components/rooms/create-room-modal'
import { JoinRoomAuthModal } from '@/components/rooms/join-room-auth-modal'
import { Pagination } from '@/components/ui/pagination'
import { AlertBox } from '@/components/ui/alert-box'
import { Plus } from 'lucide-react'
import type { Game } from '@/types'
import { EmptyState } from './components/empty-state'
import { useAutoJoin } from './use-auto-join'
import { useCatalogCommands } from './use-catalog-commands'
import { useCatalogData } from './use-catalog-data'
import { useCatalogEvents } from './use-catalog-events'
import { usePagination } from './use-pagination'

/**
 * The catalog page. It owns the public navigation state (filters, pagination
 * and the shared `?join=` link), the join/create workflows and the realtime
 * subscription; query keys, event names and cache mutations stay inside the
 * capability.
 */
export function CatalogPage() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [joinAuthModalOpen, setJoinAuthModalOpen] = useState(false)
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null)
  const [joiningRoomCode, setJoiningRoomCode] = useState<string | null>(null)

  // WebSocket for real-time room list updates
  const { on, subscribe } = useWebSocket({
    url: WS_URL,
    autoConnect: true,
  })

  useCatalogEvents({ subscribe })
  useNotificationEvents({ on })

  const { rooms, roomsLoading, roomsError, games, gamesLoading, gamesError } = useCatalogData()
  const { refreshRooms } = useCatalogCommands()

  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: (body: {
      name: string
      gameId: string
      maxPlayers?: number
      discordLink: string
      tags: string[]
      language: 'en' | 'pt-br'
    }) => api.post('/api/rooms', body, createRoomResponseSchema),
    onSuccess: (result) => {
      setModalOpen(false)
      // The creating tab may miss its own `room_created` (the event can arrive
      // after this page unmounts), so the new room is requested explicitly,
      // like the join flow does. The navigate follows immediately; the
      // in-flight refresh survives the unmount.
      void refreshRooms()
      navigate({ to: '/rooms/$code', params: { code: result.room.code } })
    },
  })

  // Join room mutation
  const joinRoomMutation = useMutation({
    mutationFn: (roomCode: string) => api.post(`/api/rooms/${roomCode}/join`, {}),
    onSuccess: async (_, roomCode) => {
      await refreshRooms()
      navigate({ to: '/rooms/$code', params: { code: roomCode } })
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err))
      setJoiningRoomCode(null)
    },
  })

  useAutoJoin({ session, mutate: joinRoomMutation.mutate })

  const handleSignInToJoin = () => {
    if (!pendingJoinCode) return

    signIn.social({
      provider: 'discord',
      callbackURL: `${window.location.origin}/rooms?join=${encodeURIComponent(pendingJoinCode)}`,
    })
  }

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
                onJoin={(code) => {
                  if (room.isMember) {
                    navigate({ to: '/rooms/$code', params: { code } })
                  } else if (!session?.user) {
                    setPendingJoinCode(code)
                    setJoinAuthModalOpen(true)
                  } else {
                    setJoiningRoomCode(code)
                    joinRoomMutation.mutate(code)
                  }
                }}
                isLoading={!room.isMember && joiningRoomCode === room.code}
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
      {session?.user && (
        <CreateRoomModal
          games={games}
          onSubmit={(data) => createRoomMutation.mutateAsync(data)}
          isLoading={createRoomMutation.isPending}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      )}

      <JoinRoomAuthModal
        open={joinAuthModalOpen}
        roomCode={pendingJoinCode}
        onOpenChange={(open) => {
          setJoinAuthModalOpen(open)
          if (!open) {
            setPendingJoinCode(null)
          }
        }}
        onSignIn={handleSignInToJoin}
      />
    </div>
  )
}
