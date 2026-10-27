import { useMutation } from '@tanstack/react-query'
import { createRoomResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { useAppNavigation } from '@/lib/navigation'
import { lobbyHref } from '@/lib/squad-links'
// The board's barrel exports only its cache commands, so this import cannot close a cycle back to the page that renders this dialog.
import { useMySquadsCommands } from '@/features/my-squads'
import { useSquadBoardCommands } from '@/features/squad-board'
import type { Squad } from '@/types'
import type { CreateRoomInput } from '@squadzr/schemas'

interface UseCreateSquadOptions {
  onClose: () => void
  onCreated?: (squad: Squad) => void
}

/**
 * The creation mutation: on success it closes the dialog, requests the board and My Squads refreshes, tells the
 * caller and opens the new lobby.
 */
export function useCreateSquad({ onClose, onCreated }: UseCreateSquadOptions) {
  // The lobby is still served by the old app, so the navigation goes through the shell's helper.
  const navigateApp = useAppNavigation()
  const { refreshSquads } = useSquadBoardCommands()
  const { refreshMySquads } = useMySquadsCommands()

  return useMutation({
    mutationFn: (input: CreateRoomInput) => api.post('/api/rooms', input, createRoomResponseSchema),
    onSuccess: (result) => {
      // The caller unmounts the dialog; a fresh mount starts from an empty form.
      onClose()
      // The creating tab may miss its own `room_created` (the event can arrive
      // after this page unmounts), so the new squad is requested explicitly,
      // like the join flow does. The navigate follows immediately; the
      // in-flight refresh survives the unmount.
      void refreshSquads()
      void refreshMySquads()
      onCreated?.(result.room)
      navigateApp(lobbyHref(result.room.code))
    },
  })
}
