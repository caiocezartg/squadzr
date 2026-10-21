import { DialogMotionProvider } from '@/components/ui/dialog-motion-provider'
import { CreateRoomModal, type CreateRoomModalProps } from '@/features/room-creation'

/**
 * The create dialog with the animation features its card plays. It is imported with the board, so the
 * first open shows the dialog at once, and it animates on the App Router as it does in the old app shell.
 */
export function CreateSquadDialog(props: CreateRoomModalProps) {
  return (
    <DialogMotionProvider>
      <CreateRoomModal {...props} />
    </DialogMotionProvider>
  )
}
