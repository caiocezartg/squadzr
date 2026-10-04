import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSession } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
import { useWebSocket } from '@/hooks/use-websocket'
import { useRoomsCache } from '@/hooks/use-rooms-cache'
import { useNotificationEvents } from '@/hooks/use-notification-events'
import { useTimeAgo } from '@/hooks/use-time-ago'
import {
  applyPresence,
  presenceFromSnapshot,
  rosterFromSnapshot,
  type PresenceState,
  type RoomSnapshot,
} from '@/lib/lobby-snapshot'
import { PlayerSlot } from '@/components/rooms/player-slot'
import { ConnectionStatus } from '@/components/rooms/connection-status'
import { RoomNotFound } from '@/components/rooms/room-not-found'
import { DiscordLinkCard } from '@/components/rooms/discord-link-card'
import { AlertBox } from '@/components/ui/alert-box'
import { gameResponseSchema, isRoomLobbyResponse, roomResponseSchema } from '@squadzr/schemas'
import { ArrowLeft, Copy, LogOut } from 'lucide-react'
import { WS_URL } from '@/env'

export const Route = createFileRoute('/rooms/$code')({
  component: RoomLobbyPage,
})

/** Room codes travel uppercased by contract; URLs may still arrive lowercase. */
function matchesRoomCode(eventCode: string, code: string): boolean {
  return eventCode.toUpperCase() === code.toUpperCase()
}

function RoomLobbyPage() {
  const { t } = useTranslation()
  const { code } = Route.useParams()
  const { data: session, isPending: sessionPending } = useSession()
  const navigate = useNavigate()
  const { removeRoom } = useRoomsCache()
  const queryClient = useQueryClient()

  // Live lobby state: the room snapshot is the only source for roster,
  // readiness, Presence and the authorized Discord link. The HTTP response
  // supplies room metadata before the first snapshot and never overwrites it.
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [presence, setPresence] = useState<PresenceState>({})
  const [error, setError] = useState<string | null>(null)
  const [membershipRevoked, setMembershipRevoked] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  // Fetch room data
  const {
    data: roomData,
    isLoading: roomLoading,
    error: roomError,
  } = useQuery({
    queryKey: ['room', code],
    queryFn: () => api.get(`/api/rooms/${code}`, roomResponseSchema),
  })

  const room = snapshot?.room ?? roomData?.room ?? null
  // Lobby details (Discord invite) only come back for members of the room
  const lobby = roomData && isRoomLobbyResponse(roomData) ? roomData : null
  const discordLink = snapshot?.room.discordLink ?? lobby?.room.discordLink ?? null
  const isRoomReady = snapshot?.readyAt != null
  const players = useMemo(() => (snapshot ? rosterFromSnapshot(snapshot) : []), [snapshot])

  const timeAgo = useTimeAgo(room?.createdAt)

  // Fetch game for cover image
  const { data: gameData } = useQuery({
    queryKey: ['game', room?.gameId],
    queryFn: () => api.get(`/api/games/${room?.gameId}`, gameResponseSchema),
    enabled: !!room?.gameId,
    staleTime: 60_000,
  })

  const game = gameData?.game ?? null

  // WebSocket connection
  const { status, send, on, subscribe } = useWebSocket({
    url: WS_URL,
    autoConnect: true,
  })

  useNotificationEvents({ on })

  // Subscribe to the room channel. The transport replays this subscription
  // after every reconnect and the fresh snapshot replaces all live state.
  const userId = session?.user?.id
  // The code this page last asked the server to join. When it changes, the
  // socket must release the previous room channel before joining the new one.
  const joinedCodeRef = useRef<string | null>(null)
  // The `:code` currently rendered. It updates in the commit phase, before the
  // transport can hand another frame to the previous room's handlers, so a
  // late error from a room this page has already left sees a mismatch below.
  const activeCodeRef = useRef(code)

  useLayoutEffect(() => {
    activeCodeRef.current = code
  }, [code])

  useEffect(() => {
    // A different room code must never show the previous room's live state.
    setSnapshot(null)
    setPresence({})
    setError(null)
    setMembershipRevoked(false)

    const previousCode = joinedCodeRef.current
    joinedCodeRef.current = userId ? code : null
    if (!userId) return

    if (previousCode && previousCode !== code) {
      send({ type: 'leave_room', payload: { roomCode: previousCode } })
    }

    return subscribe(
      { type: 'join_room', payload: { roomCode: code } },
      {
        room_snapshot: (payload) => {
          // Events for the previous room may still be in flight while the
          // server processes the switch; they must never touch this page.
          if (!matchesRoomCode(payload.room.code, code)) return
          setSnapshot(payload)
          setPresence(presenceFromSnapshot(payload))
          // The authoritative snapshot of this room supersedes any error a
          // previous join left behind (e.g. a late NOT_ROOM_MEMBER).
          setError(null)
          setMembershipRevoked(false)
        },
        presence_updated: (payload) => {
          if (!matchesRoomCode(payload.roomCode, code)) return
          setPresence((current) => applyPresence(current, payload.playerId, payload.online))
        },
        room_deleted: (payload) => {
          if (!matchesRoomCode(payload.roomCode, code)) return
          removeRoom(payload.roomId)
          navigate({ to: '/rooms', search: {} })
        },
        error: (payload) => {
          // Error payloads carry no roomCode, so the join order is the only
          // evidence: a handler from a room the page has already left must not
          // poison the new room with a delayed error.
          if (activeCodeRef.current !== code) return
          setError(payload.message)
          if (payload.code === 'NOT_ROOM_MEMBER') {
            // Membership was revoked: the last snapshot is no longer
            // authorized, so the page falls back to the error alone.
            setSnapshot(null)
            setPresence({})
            setMembershipRevoked(true)
          }
        },
      }
    )
  }, [subscribe, send, userId, code, navigate, removeRoom])

  const handleLeaveRoom = async () => {
    try {
      const isHost = room?.hostId === session?.user?.id
      send({ type: 'leave_room', payload: { roomCode: code } })
      await api.post(`/api/rooms/${code}/leave`, {})
      if (isHost && room) {
        removeRoom(room.id)
      }
      await queryClient.invalidateQueries({ queryKey: ['rooms'] })
      navigate({ to: '/rooms', search: {} })
    } catch (err) {
      toast.error(getUserFriendlyError(err))
    }
  }

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code)
    setCodeCopied(true)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCodeCopied(false), 2000)
  }

  // Build empty slots
  const maxPlayers = snapshot?.room.maxPlayers ?? roomData?.room.maxPlayers ?? 5
  const emptySlots = Math.max(0, maxPlayers - players.length)

  if (sessionPending || roomLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="card h-48 animate-pulse mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-muted">{t('rooms.lobby.pleaseSignIn')}</p>
      </div>
    )
  }

  if (roomError) {
    return <RoomNotFound code={code} />
  }

  // Revoked membership: only the error state remains, never the last snapshot.
  if (membershipRevoked) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-12 sm:px-6 lg:px-8">
        <Link
          to="/rooms"
          search={{}}
          className="flex w-fit items-center gap-2 rounded-lg border border-border-light bg-surface px-4 py-2 text-sm text-muted hover:border-muted/30 hover:bg-surface-hover hover:text-offwhite transition-all"
        >
          <ArrowLeft className="size-4" />
          {t('rooms.lobby.backToRooms')}
        </Link>
        <AlertBox type="error" message={error ?? t('errors.NOT_ROOM_MEMBER')} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/rooms"
          search={{}}
          className="flex items-center gap-2 rounded-lg border border-border-light bg-surface px-4 py-2 text-sm text-muted hover:text-offwhite hover:border-muted/30 hover:bg-surface-hover transition-all"
        >
          <ArrowLeft className="size-4" />
          {t('rooms.lobby.backToRooms')}
        </Link>
        <button
          onClick={handleLeaveRoom}
          disabled={isRoomReady}
          className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/5 px-4 py-2 text-sm text-danger/80 hover:text-danger hover:bg-danger/10 hover:border-danger/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title={isRoomReady ? t('rooms.lobby.cannotLeave') : undefined}
        >
          <LogOut className="size-4" />
          {isRoomReady ? t('rooms.lobby.squadLocked') : t('rooms.lobby.leaveRoom')}
        </button>
      </div>

      {/* Room Header with game cover background */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        {/* Background image */}
        <div className="absolute inset-0">
          {game?.coverUrl ? (
            <img
              src={game.coverUrl}
              alt=""
              className="w-full h-full object-cover scale-110 blur-sm"
            />
          ) : (
            <div className="w-full h-full bg-surface-light" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/70" />
        </div>

        {/* Header content */}
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {game && <span className="badge-accent text-[10px]">{game.name}</span>}
                {room?.language && (
                  <span className="badge-muted text-[10px]">
                    {room.language === 'pt-br' ? 'PT-BR' : 'EN'}
                  </span>
                )}
                <span className="badge-muted text-[10px]">{timeAgo}</span>
                <ConnectionStatus status={status} />
              </div>
              {room?.tags && room.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {room.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="font-heading text-2xl font-bold sm:text-3xl">{room?.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-offwhite transition-colors"
                >
                  <span className="font-mono font-bold text-offwhite">{code}</span>
                  <Copy className="size-3.5" />
                  {codeCopied && (
                    <span className="text-xs text-accent">{t('rooms.lobby.copied')}</span>
                  )}
                </button>
                <span className="text-sm text-muted">
                  {t('rooms.lobby.playerCount', { current: players.length, max: maxPlayers })}
                </span>
              </div>
            </div>

            {/* Game cover thumbnail */}
            {game?.coverUrl && (
              <img
                src={game.coverUrl}
                alt={game.name}
                className="hidden sm:block w-20 h-28 rounded-lg object-cover border border-border shadow-lg"
              />
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <AlertBox type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Discord invite — full-width, prominent */}
      {isRoomReady && discordLink && (
        <div className="mb-6">
          <DiscordLinkCard discordLink={discordLink} isRoomReady={isRoomReady} />
        </div>
      )}

      {/* Players — full width */}
      <div className="card p-5">
        <h2 className="font-heading text-sm font-bold text-muted mb-4 uppercase tracking-wider">
          {t('rooms.lobby.players', { current: players.length, max: maxPlayers })}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {players.map((player, i) => (
            <PlayerSlot key={player.id} player={player} index={i} online={presence[player.id]} />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <PlayerSlot key={`empty-${i}`} index={players.length + i} />
          ))}
        </div>
      </div>
    </div>
  )
}
