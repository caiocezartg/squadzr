// The Squad Chat refuses links, so a member cannot share the Discord invite before the Squad is complete.
// A link is any of: a scheme (`https://`, `discord://`), a `www.` address, or a bare domain such as
// `discord.gg/abc`. A bare domain counts when its last label is a common TLD, or when a path follows it.
// An e-mail address is not a link: a domain glued to the end of a word (or an `@`) never starts a match.

// The top-level domains a bare domain is matched on without a path. Short words that end a sentence in
// chat ("it", "in", "to", "so", "pro", "top") are left out, since a missing space after a full stop would
// match them.
const COMMON_TLDS = [
  'com',
  'net',
  'org',
  'edu',
  'gov',
  'io',
  'gg',
  'br',
  'me',
  'tv',
  'app',
  'dev',
  'co',
  'ly',
  'link',
  'xyz',
  'info',
  'biz',
  'gl',
  'cc',
  'ru',
  'us',
  'uk',
  'de',
  'fr',
  'es',
  'pt',
  'eu',
  'ca',
  'ai',
  'sh',
  'fm',
  'ws',
  'site',
  'online',
  'store',
  'shop',
  'live',
  'club',
  'page',
  'chat',
  'games',
  'gift',
] as const

const NOT_AFTER = String.raw`(?<![\p{L}\p{N}@._-])`
const LABEL = String.raw`[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?`
const DOMAIN = String.raw`(?:${LABEL}\.)+`

const SCHEME = String.raw`${NOT_AFTER}[a-z][a-z\d+.-]*:\/\/\S`
const WWW = String.raw`${NOT_AFTER}www\.\S`
const KNOWN_TLD = String.raw`${NOT_AFTER}${DOMAIN}(?:${COMMON_TLDS.join('|')})(?![\p{L}\p{N}_-])`
const WITH_PATH = String.raw`${NOT_AFTER}${DOMAIN}\p{L}{2,}\/`

const LINK = new RegExp([SCHEME, WWW, KNOWN_TLD, WITH_PATH].join('|'), 'iu')

/** True when the text holds a link the Squad Chat refuses. */
export function containsLink(text: string): boolean {
  return LINK.test(text)
}
