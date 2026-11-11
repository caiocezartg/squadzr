'use client'

import { useState, type RefObject } from 'react'
import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AdminSquadDto } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import { lobbyHref } from '@/lib/squad-links'
import { CloseSquadDialog, type CloseSquadTarget } from './close-squad-dialog'
import { SidePanel } from './side-panel'
import { SquadFacts } from './squad-facts'
import { SquadMembers } from './squad-members'
import { SquadThumb, useSquadMeta } from './squad-parts'
import { SquadPanelError, SquadPanelGone, SquadPanelSkeleton } from './squad-panel-states'
import { useSquadPanelView, type SquadPanelView } from './use-squad-panel-view'

interface SquadPanelProps {
  /** The Squad the URL opens, or `null` when the panel is closed. */
  readonly squadId: string | null
  /** The open Squad's row in the list on screen, the header's instant placeholder. */
  readonly row: AdminSquadDto | null
  readonly returnFocus: RefObject<HTMLElement | null>
  readonly onClose: () => void
  /** The Squad was closed through the dialog; the panel is closing. */
  readonly onSquadClosed: (name: string) => void
}

/**
 * The open Squad's side panel: poster, "Game · Platform · #CODE" and name, the facts, the roster, and
 * Open in the app or Close Squad. The list row fills the header at once while the detail is read.
 */
export function SquadPanel({ squadId, row, returnFocus, onClose, onSquadClosed }: SquadPanelProps) {
  const t = useTranslations('admin.squads.panel')
  const { view, retry } = useSquadPanelView(squadId, row)
  // The dialog keeps the Squad it was opened for, so a refusal stays readable after the Squad is gone.
  const [dialog, setDialog] = useState<CloseDialogState>({ open: false, key: 0, target: null })
  const squad = view?.kind === 'detail' || view?.kind === 'row' ? view.squad : null

  // The panel closed some other way (Back): the dialog inside it goes too.
  if (squadId === null && dialog.open) setDialog({ ...dialog, open: false })

  return (
    <SidePanel
      open={squadId !== null}
      onClose={onClose}
      title={squad?.name ?? t('fallbackTitle')}
      caption={squad ? <SquadCaption squad={squad} /> : undefined}
      media={squad ? <SquadThumb url={squad.game.coverThumbUrl} large /> : undefined}
      returnFocus={returnFocus}
      busy={view?.kind === 'row' || view?.kind === 'loading'}
      footer={
        squad && (
          <>
            <Button
              variant="ghost"
              href={lobbyHref(squad.code)}
              icon={<ExternalLink aria-hidden="true" />}
            >
              {t('openInApp')}
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                setDialog(({ key }) => ({
                  open: true,
                  key: key + 1,
                  target: { id: squad.id, name: squad.name, memberCount: squad.memberCount },
                }))
              }
            >
              {t('closeSquad')}
            </Button>
          </>
        )
      }
    >
      <SquadPanelBody view={view} onClose={onClose} onRetry={retry} />
      {dialog.target && (
        <CloseSquadDialog
          key={dialog.key}
          open={dialog.open}
          squad={dialog.target}
          onCancel={() => setDialog((current) => ({ ...current, open: false }))}
          onClosed={(name) => {
            setDialog((current) => ({ ...current, open: false }))
            onSquadClosed(name)
          }}
        />
      )}
    </SidePanel>
  )
}

interface CloseDialogState {
  readonly open: boolean
  /** A new key for each opening, so the reason and the last refusal start empty. */
  readonly key: number
  readonly target: CloseSquadTarget | null
}

function SquadCaption({ squad }: { readonly squad: AdminSquadDto }) {
  return `${useSquadMeta(squad)} · #${squad.code}`
}

interface SquadPanelBodyProps {
  readonly view: SquadPanelView | null
  readonly onClose: () => void
  readonly onRetry: () => void
}

function SquadPanelBody({ view, onClose, onRetry }: SquadPanelBodyProps) {
  switch (view?.kind) {
    case 'detail':
      return (
        <>
          <SquadFacts squad={view.squad} />
          <SquadMembers members={view.squad.members} />
        </>
      )
    case 'gone':
      return <SquadPanelGone onClose={onClose} />
    case 'error':
      return <SquadPanelError onRetry={onRetry} />
    default:
      return <SquadPanelSkeleton />
  }
}
