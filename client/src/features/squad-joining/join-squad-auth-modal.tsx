import { Dialog } from '@base-ui-components/react/dialog'
import * as m from 'motion/react-m'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DiscordIcon } from '@/components/ui/icons'
import { DialogMotionProvider } from '@/components/ui/dialog-motion-provider'

interface JoinSquadAuthModalProps {
  open: boolean
  squadCode: string | null
  onOpenChange: (open: boolean) => void
  onSignIn: () => void
}

/**
 * The guest's sign-in prompt. It carries the animation features its card plays, so it animates on every
 * route, and it loads with this chunk, outside the route's initial JavaScript.
 */
export function JoinSquadAuthModal(props: JoinSquadAuthModalProps) {
  return (
    <DialogMotionProvider>
      <JoinSquadAuthDialog {...props} />
    </DialogMotionProvider>
  )
}

function JoinSquadAuthDialog({ open, squadCode, onOpenChange, onSignIn }: JoinSquadAuthModalProps) {
  const t = useTranslations()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
        <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <m.div
            className="w-full max-w-xl rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <Dialog.Title className="font-heading text-lg font-bold">
                {t('squads.authModal.title')}
              </Dialog.Title>
              <Dialog.Close className="size-8 rounded-lg flex items-center justify-center text-muted hover:text-offwhite hover:bg-surface-hover transition-colors">
                <X className="size-5" />
              </Dialog.Close>
            </div>

            <div className="px-6 py-6">
              <p className="text-sm leading-relaxed text-offwhite">
                {t('squads.authModal.description')}
              </p>
              {squadCode && (
                <p className="mt-3 text-sm text-muted">
                  {t('squads.authModal.squadCode')}{' '}
                  <span className="font-mono font-semibold text-offwhite">{squadCode}</span>
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Dialog.Close className="btn-ghost h-11 flex-1 justify-center">
                  {t('squads.authModal.maybeLater')}
                </Dialog.Close>
                <button onClick={onSignIn} className="btn-discord h-11 flex-1 justify-center gap-2">
                  <DiscordIcon className="size-4" />
                  {t('squads.authModal.continueWithDiscord')}
                </button>
              </div>
            </div>
          </m.div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
