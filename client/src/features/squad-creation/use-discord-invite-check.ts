import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  discordInviteCheckResponseSchema,
  discordInviteCode,
  type DiscordInviteCheckResponse,
} from '@squadzr/schemas'
import { api } from '@/lib/api'
import { checkDiscordLink } from './discord-link'
import { useDebouncedValue } from './use-debounced-value'

/** How long the player pauses typing before Discord is asked about the invite. */
const DEBOUNCE_MS = 400
/** As long as the server keeps an invite Discord does not know: asking sooner reads the same answer. */
const CHECK_STALE_MS = 60_000

function inviteCheckQueryKey(code: string) {
  return ['discord-invite-check', code] as const
}

type ValidInviteCheck = Extract<DiscordInviteCheckResponse, { status: 'valid' }>

/** What Discord says about the invite in the field, as far as the form knows it. */
export type DiscordInviteState =
  /** The link is not an invite the contract accepts, so there is nothing to ask. */
  | { readonly status: 'idle' }
  /** The player is still typing, or Discord has not answered yet. */
  | { readonly status: 'checking' }
  | {
      readonly status: 'valid'
      readonly server: ValidInviteCheck['server']
      readonly expires: boolean
    }
  | { readonly status: 'invalid' }
  /** Discord could not be asked: the invite may be fine, and the server checks it again on submit. */
  | { readonly status: 'unknown' }

/**
 * Asks the API whether the invite in the field exists, once the player has stopped typing. Only a
 * link the contract accepts is asked about, an answer the browser already holds needs no wait, and a
 * failed request reads as "unknown" rather than as an error: the server verifies on submit anyway.
 */
export function useDiscordInviteCheck(link: string): DiscordInviteState {
  const queryClient = useQueryClient()
  const code = link !== '' && checkDiscordLink(link).valid ? discordInviteCode(link) : null
  const debouncedCode = useDebouncedValue(code, DEBOUNCE_MS)

  // A code answered before skips the wait that only spares Discord a request per keystroke.
  const known = code !== null && queryClient.getQueryData(inviteCheckQueryKey(code)) !== undefined
  const askedCode = known ? code : debouncedCode

  const { data, isError } = useQuery({
    queryKey: inviteCheckQueryKey(askedCode ?? ''),
    queryFn: ({ signal }) =>
      api.get(
        `/api/discord/invites/${encodeURIComponent(askedCode ?? '')}`,
        discordInviteCheckResponseSchema,
        signal
      ),
    enabled: code !== null && askedCode === code,
    staleTime: CHECK_STALE_MS,
    retry: false,
  })

  if (code === null) return { status: 'idle' }
  if (askedCode !== code) return { status: 'checking' }
  if (isError) return { status: 'unknown' }
  if (!data) return { status: 'checking' }
  if (data.status === 'valid') {
    return { status: 'valid', server: data.server, expires: data.expires }
  }
  return { status: data.status }
}
