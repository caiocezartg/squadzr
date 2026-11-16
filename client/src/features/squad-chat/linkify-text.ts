export type LinkifySegment =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'link'; readonly text: string; readonly href: string }

// A URL starts at `http://`, `https://` (any case) or `www.`, not glued to the end of a word, and runs
// to the next whitespace. The first character after the scheme must be part of a host.
const URL_CANDIDATE = /(?<![\p{L}\p{N}])(?:https?:\/\/|www\.)[^\s/?#][^\s]*/giu

const TRAILING_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?', "'", '"', '>'])
const CLOSING_TO_OPENING: Readonly<Record<string, string>> = { ')': '(', ']': '[', '}': '{' }
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

function countOf(value: string, character: string): number {
  return value.split(character).length - 1
}

/** True when the last character is a closing bracket whose opening one is not in the candidate. */
function endsWithUnbalancedBracket(candidate: string): boolean {
  const last = candidate.at(-1) ?? ''
  const opening = CLOSING_TO_OPENING[last]
  return opening !== undefined && countOf(candidate, last) > countOf(candidate, opening)
}

/** The part of a match that is the URL: sentence punctuation and unbalanced brackets fall off the end. */
function trimTrailing(candidate: string): string {
  let end = candidate
  while (end.length > 0) {
    const last = end.at(-1) ?? ''
    if (!TRAILING_PUNCTUATION.has(last) && !endsWithUnbalancedBracket(end)) break
    end = end.slice(0, -1)
  }
  return end
}

/** The link target of a matched URL, or null when it is not a web address the chat may link. */
function toHref(matched: string): string | null {
  const withScheme = /^www\./i.test(matched) ? `https://${matched}` : matched
  try {
    const url = new URL(withScheme)
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || url.hostname === '') return null
    return url.href
  } catch {
    return null
  }
}

/**
 * Splits a message into plain text and links. Only `http`, `https` and `www.` addresses become links, and
 * the href comes from `new URL()`, so the protocol is always http or https. The visible text of a link is
 * what the author typed, and every segment is a string for React to render as text, never as HTML.
 */
export function linkifyText(input: string): LinkifySegment[] {
  const segments: LinkifySegment[] = []
  let cursor = 0

  const pushText = (end: number) => {
    if (end > cursor) segments.push({ type: 'text', text: input.slice(cursor, end) })
  }

  for (const match of input.matchAll(URL_CANDIDATE)) {
    const matched = trimTrailing(match[0])
    const href = toHref(matched)
    if (href === null) continue

    pushText(match.index)
    segments.push({ type: 'link', text: matched, href })
    cursor = match.index + matched.length
  }

  pushText(input.length)
  return segments
}
