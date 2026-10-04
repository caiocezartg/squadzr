import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { signIn, useSession } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
import { useWebSocket } from '@/hooks/use-websocket'
import { useLobbyEvents } from '@/hooks/use-lobby-events'
import { useNotificationEvents } from '@/hooks/use-notification-events'
import { useRoomFilters } from '@/hooks/use-room-filters'
import { RoomCard } from '@/components/rooms/room-card'
import { RoomFilters } from '@/components/rooms/room-filters'
import { CreateRoomModal } from '@/components/rooms/create-room-modal'
import { JoinRoomAuthModal } from '@/components/rooms/join-room-auth-modal'
import { EmptyState } from '@/components/rooms/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { AlertBox } from '@/components/ui/alert-box'
import { Plus } from 'lucide-react'
import { roomsSearchSchema } from '@/lib/rooms-search'
import { WS_URL } from '@/env'
import {
  createRoomResponseSchema,
  gamesResponseSchema,
  roomsResponseSchema,
} from '@squadzr/schemas'
import type { Game } from '@/types'

export const Route = createFileRoute('/rooms/')({
  component: RoomsPage,
  validateSearch: (raw) => roomsSearchSchema.parse(raw),
})

function useAutoJoin({
  session,
  mutate,
}: {
  session: ReturnType<typeof useSession>['data']
  mutate: (code: string, options: { onSettled: () => void }) => void
}) {
  const searchParams = useSearch({ from: '/rooms/' })
  const navigate = useNavigate({ from: '/rooms/' })
  const autoJoinCodeRef = useRef<string | null>(null)

  useEffect(() => {
    if (!session?.user) return

    const joinCode = searchParams.join

    if (!joinCode || autoJoinCodeRef.current === joinCode) return

    autoJoinCodeRef.current = joinCode
    mutate(joinCode, {
      onSettled: () => {
        navigate({
          search: (prev) => {
            const { join: _join, ...rest } = prev
            return rest
          },
          replace: true,
        })
      },
    })
  }, [session?.user, mutate, searchParams.join, navigate])
}

function RoomsPage() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [joinAuthModalOpen, setJoinAuthModalOpen] = useState(false)
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null)
  const [joiningRoomCode, setJoiningRoomCode] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // WebSocket for real-time room list updates
  const { on, subscribe } = useWebSocket({
    url: WS_URL,
    autoConnect: true,
  })

  useLobbyEvents({ subscribe })
  useNotificationEvents({ on })

  // Fetch rooms
  const {
    data: roomsData,
    isLoading: roomsLoading,
    isError: roomsError,
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/api/rooms', roomsResponseSchema),
    refetchOnWindowFocus: true,
  })

  // Fetch games
  const {
    data: gamesData,
    isLoading: gamesLoading,
    isError: gamesError,
  } = useQuery({
    queryKey: ['games'],
    queryFn: () => api.get('/api/games', gamesResponseSchema),
    staleTime: 60_000,
  })

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
      navigate({ to: '/rooms/$code', params: { code: result.room.code } })
    },
  })

  // Join room mutation
  const joinRoomMutation = useMutation({
    mutationFn: (roomCode: string) => api.post(`/api/rooms/${roomCode}/join`, {}),
    onSuccess: async (_, roomCode) => {
      await queryClient.invalidateQueries({ queryKey: ['rooms'] })
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
  const roomCount = roomsData?.rooms?.length ?? 0

  const gamesMap = useMemo(
    () => new Map<string, Game>((gamesData?.games ?? []).map((g) => [g.id, g])),
    [gamesData?.games]
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

  const filteredRooms = applyFilters(roomsData?.rooms ?? [])

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
          games={gamesData?.games ?? []}
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
