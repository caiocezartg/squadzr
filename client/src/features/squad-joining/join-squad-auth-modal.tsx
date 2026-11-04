import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { Dialog } from '@/components/ds/dialog'
import { DiscordIcon } from '@/components/ui/icons'

interface JoinSquadAuthModalProps {
  open: boolean
  squadCode: string
  onOpenChange: (open: boolean) => void
  /** Called when the exit transition has finished, so the caller can unmount the modal. */
  onOpenChangeComplete: (open: boolean) => void
  onSignIn: () => void
}

/**
 * The guest's sign-in prompt before joining a Squad. It is the design system's dialog, imported with the
 * page, so the first open shows it at once. It stays mounted until its exit has finished.
 */
export function JoinSquadAuthModal({
  open,
  squadCode,
  onOpenChange,
  onOpenChangeComplete,
  onSignIn,
}: JoinSquadAuthModalProps) {
  const t = useTranslations()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      title={t('squads.authModal.title')}
      className="max-w-115"
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-3">
          <p className="type-body text-text-3">{t('squads.authModal.description')}</p>
          <p className="type-body text-text-3">
            {t('squads.authModal.squadCode')}{' '}
            <span className="type-code text-text text-[13px]">{squadCode}</span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            variant="discord"
            full
            icon={<DiscordIcon className="size-4" />}
            onClick={onSignIn}
          >
            {t('squads.authModal.continueWithDiscord')}
          </Button>
          <Button variant="secondary" full onClick={() => onOpenChange(false)}>
            {t('squads.authModal.maybeLater')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
