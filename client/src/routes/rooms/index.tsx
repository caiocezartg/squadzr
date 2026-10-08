import { createFileRoute } from '@tanstack/react-router'
import { CatalogPage } from '@/features/catalog'
import { CatalogSkeleton } from '@/features/catalog/skeleton'
import { roomsSearchSchema } from '@/features/room-list'

export const Route = createFileRoute('/rooms/')({
  component: CatalogPage,
  // The same skeleton covers the route chunk and the data load.
  pendingComponent: CatalogSkeleton,
  validateSearch: (raw) => roomsSearchSchema.parse(raw),
})
