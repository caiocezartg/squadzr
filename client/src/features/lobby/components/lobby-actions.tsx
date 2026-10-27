'use client'

import { ArrowLeft, Link as LinkIcon, Lock, LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { CopySwap } from '@/components/ds/copy-swap'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { lobbyHref } from '@/lib/squad-links'
import type { RealtimeStatus } from '@/lib/ws-client'
import { useCopiedFlag } from '../use-copied-flag'
import { ConnectionStatus } from './connection-status'

interface LobbyActionsProps {
  squadCode: string
  connectionStatus: RealtimeStatus
  isHost: boolean
  isReady: boolean
  onLeave: () => Promise<void>
}

/** In a row narrower than 656px the label goes and the button is the icon alone (reference, Responsive). */
const ICON_ON_NARROW = '@max-[41rem]:size-11 @max-[41rem]:px-0'
/** The way back keeps its label until the row runs out of room, so the actions stay on one line. */
const ICON_ON_TIGHT = '@max-[24rem]:size-11 @max-[24rem]:px-0'

/**
 * The Lobby's header actions (reference, Lobby): the way back to the board, the connection, the squad
 * link, the bell at wide widths, and the leave action. The host ends the Squad, a member leaves it, and
 * both go through the same leave flow; once the Squad is Ready nobody can leave.
 */
export function LobbyActions({
  squadCode,
  connectionStatus,
  isHost,
  isReady,
  onLeave,
}: LobbyActionsProps) {
  const t = useTranslations('ds.lobby')
  const tLobby = useTranslations('lobby')
  const [linkCopied, markLinkCopied] = useCopiedFlag()

  const copyLink = async () => {
    await navigator.clipboard.writeText(new URL(lobbyHref(squadCode), window.location.origin).href)
    markLinkCopied()
  }
  const leaveLabel = isHost ? t('endSquad') : t('leaveSquad')

  return (
    <div className="@container">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          href="/squads"
          aria-label={t('exploreSquads')}
          className={ICON_ON_TIGHT}
          icon={<ArrowLeft />}
        >
          <span className="@max-[24rem]:hidden">{t('exploreSquads')}</span>
        </Button>
        <div className="flex items-center gap-2">
          <ConnectionStatus status={connectionStatus} />
          <Button
            variant="secondary"
            aria-label={linkCopied ? t('linkCopied') : t('copyLink')}
            className={ICON_ON_NARROW}
            onClick={() => void copyLink()}
          >
            <CopySwap
              copied={linkCopied}
              idle={
                <>
                  <LinkIcon className="size-3.75 stroke-[2.6]" />
                  <span className="@max-[41rem]:hidden">{t('copyLink')}</span>
                </>
              }
              done={
                <>
                  <LinkIcon className="size-3.75 stroke-[2.6]" />
                  <span className="@max-[41rem]:hidden">{t('linkCopied')}</span>
                </>
              }
            />
          </Button>
          <NotificationsBell placement="page" />
          {isReady ? (
            <Button
              variant="secondary"
              disabled
              title={tLobby('cannotLeave')}
              aria-label={t('teamClosed')}
              className={ICON_ON_NARROW}
              icon={<Lock />}
            >
              <span className="@max-[41rem]:hidden">{t('teamClosed')}</span>
            </Button>
          ) : (
            <Button
              variant="danger"
              aria-label={leaveLabel}
              className={ICON_ON_NARROW}
              icon={<LogOut />}
              onClick={() => void onLeave()}
            >
              <span className="@max-[41rem]:hidden">{leaveLabel}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
