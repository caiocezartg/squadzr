'use client'

import { Suspense, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { parseDiscordInvite } from '@squadzr/schemas'
import { AlertBox } from '@/components/ui/alert-box'
import { MotionProvider } from '@/components/ui/motion-provider'
import { useSession } from '@/hooks/use-session'
import { translateErrorCode } from '@/lib/error-messages'
import { useJoinSquad } from '@/features/squad-joining/join'
import { LockedInvite, ReadyInvite } from './components/discord-invite'
import { LobbyBackLink } from './components/lobby-back-link'
import { LobbyActions } from './components/lobby-actions'
import { LobbyColumns } from './components/lobby-columns'
import { LobbyCover } from './components/lobby-cover'
import { MembersPanel } from './components/members-panel'
import { NonMemberLobby } from './components/non-member-lobby'
import { SquadErrorBoundary } from './components/squad-error-boundary'
import { SquadNotFound } from './components/squad-not-found'
import { LobbySkeleton } from './skeleton'
import { discardFailedSquadRead } from './squad-details'
import { useDiscordPreview } from './use-discord-preview'
import { useLobbyChannel, useLobbyView, type LobbyView } from './use-lobby'
import { useReadyEntrance } from './use-ready-entrance'
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
      <p className="text-ds-muted">{t('lobby.pleaseSignIn')}</p>
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

/**
 * The Lobby once its Squad is read: the sign-in gate, the not-found state, the public view of a Squad the
 * viewer is not in, or the Squad itself.
 */
function LobbyContent({ squadCode, channel }: LobbyContentProps) {
  const t = useTranslations()
  const session = useSession()
  const lobby = useLobbyView(squadCode, channel)
  const { join, joining } = useJoinSquad()
  const readyEntrance = useReadyEntrance({
    squadCode,
    hasSnapshot: lobby.hasSnapshot,
    isReady: lobby.isReady,
    isOutside: !lobby.isMember && lobby.squad !== null,
  })

  if (!session?.user) {
    return <SignInPrompt />
  }

  if (lobby.squadMissing) {
    return <SquadNotFound code={squadCode} />
  }

  // A viewer outside the Squad sees its public projection, whatever the socket says: a join becomes the
  // member view once the Squad's details are read again.
  if (!lobby.isMember && lobby.squad) {
    return (
      <NonMemberLobby
        squad={lobby.squad}
        viewerId={session.user.id}
        joining={joining}
        onJoin={() => join(squadCode)}
      />
    )
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

  return (
    <div className="flex flex-col gap-5 px-4 pt-6.5 pb-12 sm:px-6 lg:px-10">
      <LobbyActions
        squadCode={squadCode}
        connectionStatus={lobby.connectionStatus}
        isHost={lobby.squad?.hostId === session.user.id}
        isReady={lobby.isReady}
        onLeave={lobby.leaveSquad}
      />

      {lobby.errorCode && (
        <AlertBox
          type="error"
          message={translateErrorCode(lobby.errorCode, t)}
          onClose={lobby.dismissError}
        />
      )}

      <LobbyColumns cover={<LobbyCover squad={lobby.squad} />}>
        <MembersPanel
          key={squadCode}
          squadCode={squadCode}
          players={lobby.players}
          maxPlayers={lobby.maxPlayers}
          presence={lobby.presence}
          viewerId={session.user.id}
          isReady={lobby.isReady}
        />
        <MemberInvite squadCode={squadCode} lobby={lobby} entering={readyEntrance} />
      </LobbyColumns>
    </div>
  )
}

interface MemberInviteProps {
  squadCode: string
  lobby: LobbyView
  entering: boolean
}

/**
 * The member's invite, under the members panel: the locked panel while the Squad forms, and the "Bora pro
 * Discord" panel once a snapshot says it is Ready. The panel renders only for a valid Discord invite, and
 * shows nothing for any other link. The Discord server behind the invite is read only for that panel.
 */
function MemberInvite({ squadCode, lobby, entering }: MemberInviteProps) {
  const invite = lobby.isReady && lobby.discordLink ? parseDiscordInvite(lobby.discordLink) : null
  const discord = useDiscordPreview(squadCode, invite !== null && lobby.squad !== null)

  if (!lobby.isReady) {
    return <LockedInvite filled={lobby.players.length} total={lobby.maxPlayers} />
  }
  if (!invite || !lobby.squad) return null

  return (
    <ReadyInvite
      invite={invite}
      squadName={lobby.squad.name}
      coverUrl={lobby.game?.coverUrl ?? null}
      online={Object.values(lobby.presence).filter((member) => member.online).length}
      members={lobby.players.length}
      preview={discord.preview}
      previewPending={discord.pending}
      entering={entering}
    />
  )
}
