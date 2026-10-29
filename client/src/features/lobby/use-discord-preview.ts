import { useQuery } from '@tanstack/react-query'
import { discordPreviewResponseSchema, type DiscordServerPreviewDto } from '@squadzr/schemas'
import { api } from '@/lib/api'

/** As long as the server keeps an answer: the browser has nothing newer to ask for before then. */
const PREVIEW_STALE_MS = 10 * 60_000

/** The query key of a Ready Squad's Discord preview. It is not under the Squad's own key, so a refresh of the details leaves it alone. */
export function discordPreviewQueryKey(squadCode: string) {
  return ['discord-preview', squadCode.toUpperCase()] as const
}

export interface DiscordPreviewState {
  /** The Discord server behind the invite, or `null` when there is none to show (yet or at all). */
  readonly preview: DiscordServerPreviewDto | null
  /** The first read is still on its way: only a cold cache is ever pending. */
  readonly pending: boolean
}

/**
 * The Discord server behind a Ready Squad's invite, read through the API (which asks Discord and caches the
 * answer). Whatever goes wrong (an invalid invite, Discord down, a failed request) reads as no preview, so
 * the Lobby falls back to the Squad's own data and never to an error.
 */
export function useDiscordPreview(squadCode: string, enabled: boolean): DiscordPreviewState {
  const { data, isPending } = useQuery({
    queryKey: discordPreviewQueryKey(squadCode),
    queryFn: () =>
      api.get(
        `/api/rooms/${encodeURIComponent(squadCode)}/discord-preview`,
        discordPreviewResponseSchema
      ),
    enabled,
    staleTime: PREVIEW_STALE_MS,
    retry: false,
  })

  return { preview: data?.preview ?? null, pending: enabled && isPending }
}
