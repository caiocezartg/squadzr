import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { roomsSearchSchema } from '@/lib/rooms-search'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Tabs } from '@base-ui-components/react'
import { useSession } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { useRoomFilters } from '@/hooks/use-room-filters'
import { RoomCard } from '@/components/rooms/room-card'
import { RoomFilters } from '@/components/rooms/room-filters'
import { CreateRoomModal } from '@/features/room-creation'
import { AlertBox } from '@/components/ui/alert-box'
import { Plus } from 'lucide-react'
import { gamesResponseSchema, myRoomsResponseSchema } from '@squadzr/schemas'
import type { Game } from '@/types'

export const Route = createFileRoute('/rooms/my')({
  component: MyRoomsPage,
  validateSearch: (raw) => roomsSearchSchema.parse(raw),
})

function MyRoomsPage() {
  const { t } = useTranslation()
  const { data: session, isPending: sessionLoading } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)

  // Redirect unauthenticated users
  useEffect(() => {
    if (!sessionLoading && !session?.user) {
      navigate({ to: '/' })
    }
  }, [sessionLoading, session?.user, navigate])

  // Fetch my rooms
  const {
    data: myRoomsData,
    isLoading: myRoomsLoading,
    isError: myRoomsError,
  } = useQuery({
    queryKey: ['my-rooms'],
    queryFn: () => api.get('/api/rooms/my', myRoomsResponseSchema),
    enabled: !!session?.user,
    refetchOnWindowFocus: true,
  })

  // Fetch games
  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: ['games'],
    queryFn: () => api.get('/api/games', gamesResponseSchema),
    staleTime: 60_000,
    enabled: !!session?.user,
  })

  const loading = sessionLoading || myRoomsLoading || gamesLoading

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
    hasActiveFilters,
    applyFilters,
  } = useRoomFilters(gamesMap, '/rooms/my')

  const filteredHosted = applyFilters(myRoomsData?.hosted ?? [])
  const filteredJoined = applyFilters(myRoomsData?.joined ?? [])

  const hostedCount = myRoomsData?.hosted.length ?? 0
  const joinedCount = myRoomsData?.joined.length ?? 0

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

  if (!session?.user) {
    return null
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">
            {t('rooms.myRooms.title')}
          </h1>
          <p className="mt-1 text-sm text-muted">{t('rooms.myRooms.subtitle')}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-accent gap-2">
          <Plus className="size-4" />
          {t('common.createNewRoom')}
        </button>
      </div>

      {myRoomsError && (
        <div className="mb-6">
          <AlertBox type="error" message={t('rooms.myRooms.loadError')} />
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

      <Tabs.Root defaultValue="created" className="mt-6">
        {/* Tab list */}
        <Tabs.List className="flex gap-1 border-b border-white/10 mb-6">
          <Tabs.Tab
            value="created"
            className="px-4 py-2.5 text-sm font-medium text-white/50 transition-colors cursor-pointer data-[selected]:text-accent data-[selected]:border-b-2 data-[selected]:border-accent hover:text-white/80 -mb-px outline-none"
          >
            {t('rooms.myRooms.tabCreated', { count: hostedCount })}
          </Tabs.Tab>
          <Tabs.Tab
            value="joined"
            className="px-4 py-2.5 text-sm font-medium text-white/50 transition-colors cursor-pointer data-[selected]:text-accent data-[selected]:border-b-2 data-[selected]:border-accent hover:text-white/80 -mb-px outline-none"
          >
            {t('rooms.myRooms.tabJoined', { count: joinedCount })}
          </Tabs.Tab>
        </Tabs.List>

        {/* Created panel */}
        <Tabs.Panel value="created">
          {filteredHosted.length === 0 ? (
            <p className="text-white/40 text-sm py-6">
              {hasActiveFilters
                ? t('rooms.myRooms.noRoomsFiltered')
                : t('rooms.myRooms.noRoomsYet')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHosted.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  game={gamesMap.get(room.gameId)}
                  onJoin={(code) => {
                    navigate({ to: '/rooms/$code', params: { code } })
                  }}
                  isLoading={false}
                  currentMembers={room.memberCount}
                />
              ))}
            </div>
          )}
        </Tabs.Panel>

        {/* Joined panel */}
        <Tabs.Panel value="joined">
          {filteredJoined.length === 0 ? (
            <p className="text-white/40 text-sm py-6">
              {hasActiveFilters
                ? t('rooms.myRooms.noRoomsFiltered')
                : t('rooms.myRooms.noRoomsYet')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJoined.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  game={gamesMap.get(room.gameId)}
                  onJoin={(code) => {
                    navigate({ to: '/rooms/$code', params: { code } })
                  }}
                  isLoading={false}
                  currentMembers={room.memberCount}
                />
              ))}
            </div>
          )}
        </Tabs.Panel>
      </Tabs.Root>

      {/* Create room modal */}
      <CreateRoomModal
        games={gamesData?.games ?? []}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ['my-rooms'] })
        }}
      />
    </div>
  )
}
