import { createFileRoute } from '@tanstack/react-router'
import { CatalogPage } from '@/features/catalog'
import { roomsSearchSchema } from '@/lib/rooms-search'

export const Route = createFileRoute('/rooms/')({
  component: CatalogPage,
  validateSearch: (raw) => roomsSearchSchema.parse(raw),
})
