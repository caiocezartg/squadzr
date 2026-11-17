import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  discordInviteCheckResponseSchema,
  discordInviteCode,
  type DiscordInviteCheckResponse,
} from '@squadzr/schemas'
import { api } from '@/lib/api'
import { checkDiscordLink } from './discord-link'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

/** How long the player pauses typing before Discord is asked about the invite. */
const DEBOUNCE_MS = 400
/** As long as the server keeps an invite Discord does not know: asking sooner reads the same answer. */
const CHECK_STALE_MS = 60_000

function inviteCheckQueryKey(code: string) {
  return ['discord-invite-check', code] as const
}

/** The invite code in the field, or null while the link is not one the contract accepts. */
function inviteCodeOf(link: string): string | null {
  return link !== '' && checkDiscordLink(link).valid ? discordInviteCode(link) : null
}

/** One request and one cache entry per code, shared by the field's query and the submit's fetch. */
function inviteCheckQuery(code: string) {
  return {
    queryKey: inviteCheckQueryKey(code),
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<DiscordInviteCheckResponse> =>
      api.get(
        `/api/discord/invites/${encodeURIComponent(code)}`,
        discordInviteCheckResponseSchema,
        signal
      ),
    staleTime: CHECK_STALE_MS,
  }
}

function toInviteState(data: DiscordInviteCheckResponse): DiscordInviteState {
  if (data.status === 'valid') {
    return { status: 'valid', server: data.server, call: data.call, expires: data.expires }
  }
  return { status: data.status }
}

/**
 * What Discord says about the link right now, for the submit. It waits for a request in flight and
 * for the debounce that has not asked yet, and reuses an answer the browser already holds. A request
 * that fails reads as "unknown", like in the field.
 */
async function settleInviteCheck(
  queryClient: QueryClient,
  link: string
): Promise<DiscordInviteState> {
  const code = inviteCodeOf(link)
  if (code === null) return { status: 'idle' }
  try {
    return toInviteState(await queryClient.fetchQuery(inviteCheckQuery(code)))
  } catch {
    return { status: 'unknown' }
  }
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
      /** The Voice Call the invite points to. */
      readonly call: ValidInviteCheck['call']
      readonly expires: boolean
    }
  /** The invite exists, but its channel is not a voice or stage channel. */
  | { readonly status: 'not_voice_call' }
  | { readonly status: 'invalid' }
  /** Discord could not be asked: nothing is known about the invite, and creation waits for a retry. */
  | { readonly status: 'unknown' }

/** The field's check: what Discord says, a way to ask again, and the answer the submit waits for. */
export interface DiscordInviteCheck {
  readonly state: DiscordInviteState
  /** Asks Discord again, past `CHECK_STALE_MS`, for an invite whose check came back "unknown". */
  readonly retry: () => void
  /** The current answer for `link`, awaiting the debounce and any request in flight. */
  readonly settle: (link: string) => Promise<DiscordInviteState>
}

/**
 * Asks the API whether the invite in the field exists and points to a voice call, once the player has
 * stopped typing. Only a link the contract accepts is asked about and an answer the browser already
 * holds needs no wait. A failed request reads as "unknown", which blocks creation like the server does
 * until a retry reaches Discord.
 */
export function useDiscordInviteCheck(link: string): DiscordInviteCheck {
  const queryClient = useQueryClient()
  const code = inviteCodeOf(link)
  const debouncedCode = useDebouncedValue(code, DEBOUNCE_MS)

  // A code answered before skips the wait that only spares Discord a request per keystroke.
  const known = code !== null && queryClient.getQueryData(inviteCheckQueryKey(code)) !== undefined
  const askedCode = known ? code : debouncedCode

  const { data, isError, isFetching, refetch } = useQuery({
    ...inviteCheckQuery(askedCode ?? ''),
    enabled: code !== null && askedCode === code,
    retry: false,
  })

  const retry = () => {
    void refetch()
  }
  const settle = (value: string) => settleInviteCheck(queryClient, value)

  return { state: stateOf({ code, askedCode, data, isError, isFetching }), retry, settle }
}

interface QueryReading {
  code: string | null
  askedCode: string | null
  data: DiscordInviteCheckResponse | undefined
  isError: boolean
  isFetching: boolean
}

function stateOf({ code, askedCode, data, isError, isFetching }: QueryReading): DiscordInviteState {
  if (code === null) return { status: 'idle' }
  if (askedCode !== code) return { status: 'checking' }
  if (isError) return { status: 'unknown' }
  if (!data) return { status: 'checking' }
  // A retry shows as checking while it runs, so the outage line and its button do not sit still.
  if (data.status === 'unknown' && isFetching) return { status: 'checking' }
  return toInviteState(data)
}
