import { DialogMotionProvider } from '@/components/ui/dialog-motion-provider'
import { CreateRoomModal, type CreateRoomModalProps } from '@/features/room-creation'

/**
 * The create dialog with the animation features its card plays. The board loads it as a lazy chunk, so
 * the route's initial JavaScript does not carry the motion runtime, and the dialog animates on the App
 * Router as it does in the old app shell.
 */
export function CreateSquadDialog(props: CreateRoomModalProps) {
  return (
    <DialogMotionProvider>
      <CreateRoomModal {...props} />
    </DialogMotionProvider>
  )
}
