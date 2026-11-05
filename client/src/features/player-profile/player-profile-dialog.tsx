'use client'

import { useTranslations } from 'next-intl'
import { BottomSheet } from '@/components/ds/bottom-sheet'
import { Dialog } from '@/components/ds/dialog'
import { useMediaQuery } from '@/components/ds/use-media-query'
import { PlayerProfileBody } from './player-profile-body'
import { usePlayerProfile } from './player-profile-query'

/** Below 768px the profile is a bottom sheet (issue #114, O visual). */
const SHEET_QUERY = '(max-width: 767px)'

/** The close button sits on the header's artwork: 32px to look at, 44px to hit. */
const CLOSE_ON_HEADER =
  'top-3 right-3 size-8 bg-[rgba(7,8,10,0.55)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] text-text-2 after:absolute after:-inset-1.5 after:content-[""]'

export interface PlayerProfileDialogProps {
  readonly playerId: string
  /** Whether the dialog is shown; it leaves with its exit transition once this turns false. */
  readonly open: boolean
  /** Dismisses the dialog by turning `open` off. */
  readonly onClose: () => void
  /** Called when the open or close transition has finished; the caller unmounts after `false`. */
  readonly onOpenChangeComplete: (open: boolean) => void
}

/**
 * A person's profile over the page: the shared dialog from 768px up and the bottom sheet below it. The
 * profile is read here, so the title names the person once it is known and the body shows the cached
 * profile at once on a reopen. It is mounted while it is shown (see `useDialogPresence`).
 */
export function PlayerProfileDialog({
  playerId,
  open,
  onClose,
  onOpenChangeComplete,
}: PlayerProfileDialogProps) {
  const t = useTranslations('playerProfile')
  const sheet = useMediaQuery(SHEET_QUERY)
  const profile = usePlayerProfile(playerId)
  const title = profile.data ? t('titleFor', { name: profile.data.name }) : t('title')
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose()
  }

  if (sheet) {
    return (
      <BottomSheet
        title={title}
        hideTitle
        open={open}
        onOpenChange={handleOpenChange}
        onOpenChangeComplete={onOpenChangeComplete}
        className="bg-panel p-0"
        closeClassName={CLOSE_ON_HEADER}
      >
        <PlayerProfileBody profile={profile} onClose={onClose} compact />
      </BottomSheet>
    )
  }

  return (
    <Dialog
      title={title}
      hideTitle
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      className="bg-panel max-w-130 shadow-[0_0_0_1px_var(--color-line),0_50px_120px_-30px_rgba(0,0,0,0.95)]"
      closeClassName={CLOSE_ON_HEADER}
    >
      <PlayerProfileBody profile={profile} onClose={onClose} compact={false} />
    </Dialog>
  )
}
