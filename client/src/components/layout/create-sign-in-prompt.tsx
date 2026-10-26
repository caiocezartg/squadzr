'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { Dialog } from '@/components/ds/dialog'
import { DiscordIcon } from '@/components/ui/icons'

interface CreateSignInPromptProps {
  readonly onClose: () => void
  readonly onSignIn: () => void
}

/**
 * What a visitor sees in place of the create dialog: a request to sign in with Discord. It is built
 * from the design system's dialog, so it adds nothing to the shell's own code.
 */
export function CreateSignInPrompt({ onClose, onSignIn }: CreateSignInPromptProps) {
  const t = useTranslations()

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={t('squads.authModal.title')}
      className="max-w-[460px]"
    >
      <div className="flex flex-col gap-6 p-6">
        <p className="type-body text-text-3">{t('ds.shell.createSignIn')}</p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            variant="discord"
            full
            icon={<DiscordIcon className="size-4" />}
            onClick={onSignIn}
          >
            {t('squads.authModal.continueWithDiscord')}
          </Button>
          <Button variant="secondary" full onClick={onClose}>
            {t('squads.authModal.maybeLater')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
