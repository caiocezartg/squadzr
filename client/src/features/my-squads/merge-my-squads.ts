import type { MyRoomsResponse, Squad } from '@/types'

/**
 * The viewer's hosted and joined Squads as one list: a Squad in both lists appears once, and the
 * newest comes first by `createdAt`. A signed-out answer (`null`) lists nothing.
 */
export function mergeMySquads(data: MyRoomsResponse | null | undefined): Squad[] {
  if (!data) return []

  const byId = new Map<string, Squad>()
  for (const squad of [...data.hosted, ...data.joined]) {
    if (!byId.has(squad.id)) byId.set(squad.id, squad)
  }

  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}
