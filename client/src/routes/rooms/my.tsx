import { createFileRoute } from '@tanstack/react-router'
import { MyRoomsPage } from '@/features/my-rooms'
import { MyRoomsSkeleton } from '@/features/my-rooms/skeleton'
import { squadsSearchSchema } from '@/features/squad-list'

export const Route = createFileRoute('/rooms/my')({
  component: MyRoomsPage,
  // The same skeleton covers the route chunk and the data load.
  pendingComponent: MyRoomsSkeleton,
  validateSearch: (raw) => squadsSearchSchema.parse(raw),
})
