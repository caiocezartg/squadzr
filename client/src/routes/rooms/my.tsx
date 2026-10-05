import { createFileRoute } from '@tanstack/react-router'
import { MyRoomsPage } from '@/features/my-rooms'
import { roomsSearchSchema } from '@/features/room-list'

export const Route = createFileRoute('/rooms/my')({
  component: MyRoomsPage,
  validateSearch: (raw) => roomsSearchSchema.parse(raw),
})
