import { DialogMotionProvider } from '@/components/ui/dialog-motion-provider'
import { CreateSquadModal, type CreateSquadModalProps } from './create-squad-modal'

/**
 * The one create-Squad dialog. It is imported with the pages that open it, so the first open shows
 * the form at once, and it carries the animation features its card plays on the App Router.
 */
export function CreateSquadDialog(props: CreateSquadModalProps) {
  return (
    <DialogMotionProvider>
      <CreateSquadModal {...props} />
    </DialogMotionProvider>
  )
}
