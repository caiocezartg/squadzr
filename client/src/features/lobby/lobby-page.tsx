'use client'

import { Suspense, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Copy, LogOut } from 'lucide-react'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { AlertBox } from '@/components/ui/alert-box'
import { MotionProvider } from '@/components/ui/motion-provider'
import { useSession } from '@/hooks/use-session'
import { useTimeAgo } from '@/hooks/use-time-ago'
import { translateErrorCode } from '@/lib/error-messages'
import { languageBadgeKey } from '@/lib/language-badge'
import { ConnectionStatus } from './components/connection-status'
import { DiscordLinkCard } from './components/discord-link-card'
import { LobbyBackLink } from './components/lobby-back-link'
import { PlayerSlot } from './components/player-slot'
import { SquadErrorBoundary } from './components/squad-error-boundary'
import { SquadNotFound } from './components/squad-not-found'
import { LobbySkeleton } from './skeleton'
import { discardFailedSquadRead } from './squad-details'
import { useCopiedFlag } from './use-copied-flag'
import { useLobbyChannel, useLobbyView } from './use-lobby'
import type { SquadChannel } from './use-squad-channel'

export interface LobbyPageProps {
  /** The Squad code from the URL. */
  squadCode: string
}

/**
 * The Lobby. The realtime channel opens here, above the Squad's read, so the socket joins while the read is
 * still pending. The read suspends the content until it has data, and a failed read falls back to the
 * not-found state, or to the sign-in prompt for a visitor. The motion provider gives the Lobby's `m`
 * components their features.
 */
export function LobbyPage({ squadCode }: LobbyPageProps) {
  const queryClient = useQueryClient()
  const [discardedCode, setDiscardedCode] = useState<string | null>(null)
  // A failed read from an earlier visit is cleared once per code this page shows. It is cleared here and not
  // in the Lobby's content, because a suspended read starts again on a remount and would clear itself.
  if (discardedCode !== squadCode) {
    discardFailedSquadRead(queryClient, squadCode)
    setDiscardedCode(squadCode)
  }

  const channel = useLobbyChannel(squadCode)

  return (
    <MotionProvider>
      <SquadErrorBoundary resetKey={squadCode} fallback={<LobbyReadFailed squadCode={squadCode} />}>
        <Suspense fallback={<LobbySkeleton />}>
          <LobbyContent squadCode={squadCode} channel={channel} />
        </Suspense>
      </SquadErrorBoundary>
    </MotionProvider>
  )
}

/** The sign-in prompt a visitor sees instead of a Squad, whatever the Squad's state. */
function SignInPrompt() {
  const t = useTranslations()

  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-muted">{t('lobby.pleaseSignIn')}</p>
    </div>
  )
}

/** The Lobby when its Squad read fails: a signed-in viewer sees the not-found state, a visitor the sign-in prompt. */
function LobbyReadFailed({ squadCode }: LobbyPageProps) {
  const session = useSession()

  return session?.user ? <SquadNotFound code={squadCode} /> : <SignInPrompt />
}

interface LobbyContentProps {
  squadCode: string
  channel: SquadChannel
}

/** The Lobby once its Squad is read: the sign-in gate, the not-found state, or the Squad itself. */
function LobbyContent({ squadCode, channel }: LobbyContentProps) {
  const t = useTranslations()
  const session = useSession()
  const lobby = useLobbyView(squadCode, channel)
  const timeAgo = useTimeAgo(lobby.squad?.createdAt)
  const [codeCopied, markCodeCopied] = useCopiedFlag()

  if (!session?.user) {
    return <SignInPrompt />
  }

  if (lobby.squadMissing) {
    return <SquadNotFound code={squadCode} />
  }

  // Revoked membership: only the error state remains, never the last snapshot.
  if (lobby.membershipRevoked) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-12 sm:px-6 lg:px-8">
        <LobbyBackLink />
        <AlertBox
          type="error"
          message={translateErrorCode(lobby.errorCode ?? 'NOT_ROOM_MEMBER', t)}
        />
      </div>
    )
  }

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(squadCode)
    markCodeCopied()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between mb-6">
        <LobbyBackLink />
        <div className="flex items-center gap-3">
          {/* At 1024px and up the bell sits in the Lobby's header; below, the top bar has it. */}
          <NotificationsBell placement="page" />
          <button
            onClick={() => void lobby.leaveSquad()}
            disabled={lobby.isReady}
            className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/5 px-4 py-2 text-sm text-danger/80 hover:text-danger hover:bg-danger/10 hover:border-danger/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title={lobby.isReady ? t('lobby.cannotLeave') : undefined}
          >
            <LogOut className="size-4" />
            {lobby.isReady ? t('lobby.squadLocked') : t('lobby.leaveSquad')}
          </button>
        </div>
      </div>

      {/* Squad header with game cover background */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        {/* Background image */}
        <div className="absolute inset-0">
          {lobby.game?.coverUrl ? (
            <img
              src={lobby.game.coverUrl}
              alt=""
              className="size-full object-cover scale-110 blur-xs"
            />
          ) : (
            <div className="size-full bg-surface-light" />
          )}
          <div className="absolute inset-0 bg-linear-to-r from-background/95 via-background/85 to-background/70" />
        </div>

        {/* Header content */}
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {lobby.game && <span className="badge-accent text-[10px]">{lobby.game.name}</span>}
                {lobby.squad?.language && (
                  <span className="badge-muted text-[10px]">
                    {t(languageBadgeKey(lobby.squad.language))}
                  </span>
                )}
                <span className="badge-muted text-[10px]">{timeAgo}</span>
                <ConnectionStatus status={lobby.connectionStatus} />
              </div>
              {lobby.squad?.tags && lobby.squad.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {lobby.squad.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="font-heading text-2xl font-bold sm:text-3xl">{lobby.squad?.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => void handleCopyCode()}
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-offwhite transition-colors"
                >
                  <span className="font-mono font-bold text-offwhite">{squadCode}</span>
                  <Copy className="size-3.5" />
                  {codeCopied && <span className="text-xs text-accent">{t('lobby.copied')}</span>}
                </button>
                <span className="text-sm text-muted">
                  {t('lobby.playerCount', {
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

      {lobby.errorCode && (
        <div className="mb-6">
          <AlertBox
            type="error"
            message={translateErrorCode(lobby.errorCode, t)}
            onClose={lobby.dismissError}
          />
        </div>
      )}

      {/* Discord invite — full-width, prominent */}
      {lobby.isReady && lobby.discordLink && (
        <div className="mb-6">
          <DiscordLinkCard discordLink={lobby.discordLink} isReady={lobby.isReady} />
        </div>
      )}

      {/* Players — full width */}
      <div className="card p-5">
        <h2 className="font-heading text-sm font-bold text-muted mb-4 uppercase tracking-wider">
          {t('lobby.players', { current: lobby.players.length, max: lobby.maxPlayers })}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lobby.players.map((player, i) => (
            <PlayerSlot
              key={player.id}
              player={player}
              index={i}
              presence={lobby.presence[player.id]}
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
