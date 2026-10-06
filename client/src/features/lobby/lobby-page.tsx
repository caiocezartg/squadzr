import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Copy, LogOut } from 'lucide-react'
import { AlertBox } from '@/components/ui/alert-box'
import { useTimeAgo } from '@/hooks/use-time-ago'
import { ConnectionStatus } from './components/connection-status'
import { DiscordLinkCard } from './components/discord-link-card'
import { PlayerSlot } from './components/player-slot'
import { RoomNotFound } from './components/room-not-found'
import { LobbySkeleton } from './skeleton'
import { useLobbyRoom } from './use-lobby-room'

export interface LobbyPageProps {
  roomCode: string
}

/**
 * The lobby page. Everything it renders comes from `useLobbyRoom`; the route
 * only supplies the room code, so event names, query keys and cache mutations
 * stay inside the capability.
 */
export function LobbyPage({ roomCode }: LobbyPageProps) {
  const { t } = useTranslation()
  const lobby = useLobbyRoom(roomCode)
  const timeAgo = useTimeAgo(lobby.room?.createdAt)
  const [codeCopied, setCodeCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(roomCode)
    setCodeCopied(true)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCodeCopied(false), 2000)
  }

  if (lobby.sessionPending || lobby.roomLoading) {
    return <LobbySkeleton />
  }

  if (!lobby.isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-muted">{t('rooms.lobby.pleaseSignIn')}</p>
      </div>
    )
  }

  if (lobby.roomNotFound) {
    return <RoomNotFound code={roomCode} />
  }

  // Revoked membership: only the error state remains, never the last snapshot.
  if (lobby.membershipRevoked) {
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
        <AlertBox type="error" message={lobby.error ?? t('errors.NOT_ROOM_MEMBER')} />
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
          onClick={() => void lobby.leaveRoom()}
          disabled={lobby.isReadyRoom}
          className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/5 px-4 py-2 text-sm text-danger/80 hover:text-danger hover:bg-danger/10 hover:border-danger/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title={lobby.isReadyRoom ? t('rooms.lobby.cannotLeave') : undefined}
        >
          <LogOut className="size-4" />
          {lobby.isReadyRoom ? t('rooms.lobby.squadLocked') : t('rooms.lobby.leaveRoom')}
        </button>
      </div>

      {/* Room Header with game cover background */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        {/* Background image */}
        <div className="absolute inset-0">
          {lobby.game?.coverUrl ? (
            <img
              src={lobby.game.coverUrl}
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
                {lobby.game && <span className="badge-accent text-[10px]">{lobby.game.name}</span>}
                {lobby.room?.language && (
                  <span className="badge-muted text-[10px]">
                    {lobby.room.language === 'pt-br' ? 'PT-BR' : 'EN'}
                  </span>
                )}
                <span className="badge-muted text-[10px]">{timeAgo}</span>
                <ConnectionStatus status={lobby.connectionStatus} />
              </div>
              {lobby.room?.tags && lobby.room.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {lobby.room.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="font-heading text-2xl font-bold sm:text-3xl">{lobby.room?.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => void handleCopyCode()}
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-offwhite transition-colors"
                >
                  <span className="font-mono font-bold text-offwhite">{roomCode}</span>
                  <Copy className="size-3.5" />
                  {codeCopied && (
                    <span className="text-xs text-accent">{t('rooms.lobby.copied')}</span>
                  )}
                </button>
                <span className="text-sm text-muted">
                  {t('rooms.lobby.playerCount', {
                    current: lobby.players.length,
                    max: lobby.maxPlayers,
                  })}
                </span>
              </div>
            </div>

            {/* Game cover thumbnail */}
            {lobby.game?.coverUrl && (
              <img
                src={lobby.game.coverUrl}
                alt={lobby.game.name}
                className="hidden sm:block w-20 h-28 rounded-lg object-cover border border-border shadow-lg"
              />
            )}
          </div>
        </div>
      </div>

      {lobby.error && (
        <div className="mb-6">
          <AlertBox type="error" message={lobby.error} onClose={lobby.dismissError} />
        </div>
      )}

      {/* Discord invite — full-width, prominent */}
      {lobby.isReadyRoom && lobby.discordLink && (
        <div className="mb-6">
          <DiscordLinkCard discordLink={lobby.discordLink} isReadyRoom={lobby.isReadyRoom} />
        </div>
      )}

      {/* Players — full width */}
      <div className="card p-5">
        <h2 className="font-heading text-sm font-bold text-muted mb-4 uppercase tracking-wider">
          {t('rooms.lobby.players', { current: lobby.players.length, max: lobby.maxPlayers })}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lobby.players.map((player, i) => (
            <PlayerSlot
              key={player.id}
              player={player}
              index={i}
              online={lobby.presence[player.id]}
            />
          ))}
          {Array.from({ length: lobby.emptySlots }).map((_, i) => (
            <PlayerSlot key={`empty-${i}`} index={lobby.players.length + i} />
          ))}
        </div>
      </div>
    </div>
  )
}
