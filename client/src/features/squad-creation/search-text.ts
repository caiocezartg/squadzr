import { normalizeSearchText } from '@squadzr/schemas'

/**
 * Locates, in a game name, the part a typed term matches. The folding is the shared
 * `normalizeSearchText` from `@squadzr/schemas` (the one Game Search applies on the server);
 * `foldWithOrigins` below produces the same text and also remembers where each character
 * came from, so the match can be marked in the original name.
 */

const MARK = /^\p{M}$/u
const LETTER_OR_DIGIT = /^[\p{L}\p{N}]$/u

/** A folded text, with the span of the original text each of its UTF-16 units came from. */
export interface FoldedText {
  readonly text: string
  /** `starts[i]` and `ends[i]` delimit, in the original text, what produced `text[i]`. */
  readonly starts: readonly number[]
  readonly ends: readonly number[]
}

interface Piece {
  readonly char: string
  readonly start: number
  readonly end: number
}

/** The code points of the NFKD form, without the marks, each with the original code point it came from. */
function decompose(original: string): Piece[] {
  const pieces: Piece[] = []
  let start = 0

  for (const codePoint of original) {
    const end = start + codePoint.length
    for (const char of codePoint.normalize('NFKD')) {
      if (!MARK.test(char)) pieces.push({ char, start, end })
    }
    start = end
  }

  return pieces
}

/**
 * Folds like {@link normalizeSearchText} and remembers where each character came from. Lowercasing
 * runs on the whole text, as on the server, because a few letters depend on their neighbours.
 */
export function foldWithOrigins(original: string): FoldedText {
  const pieces = decompose(original)
  const lowered = [
    ...pieces
      .map((piece) => piece.char)
      .join('')
      .toLowerCase(),
  ]
  // Lowercasing keeps the code point count in practice; if it ever did not, lower piece by piece.
  const chars =
    lowered.length === pieces.length ? lowered : pieces.map((piece) => piece.char.toLowerCase())

  let text = ''
  const starts: number[] = []
  const ends: number[] = []
  let separator: { start: number; end: number } | null = null

  const append = (value: string, start: number, end: number) => {
    text += value
    for (let unit = 0; unit < value.length; unit += 1) {
      starts.push(start)
      ends.push(end)
    }
  }

  for (const [index, piece] of pieces.entries()) {
    for (const char of chars[index] ?? '') {
      if (!LETTER_OR_DIGIT.test(char)) {
        separator = separator
          ? { start: separator.start, end: piece.end }
          : { start: piece.start, end: piece.end }
        continue
      }

      // A separator before the first letter is trimmed; one after the last is never written.
      if (separator && text !== '') append(' ', separator.start, separator.end)
      separator = null
      append(char, piece.start, piece.end)
    }
  }

  return { text, starts, ends }
}

/**
 * Where in `name` the typed `term` matches, as `[start, end)` offsets into the original name,
 * or `null` when it does not. The comparison ignores case, accents and punctuation, so "pokemon"
 * finds "Pokémon" and "counter strike" finds "Counter-Strike"; a name that matches only through
 * an alias or by similarity has no such part.
 */
export function findMatchRange(name: string, term: string): [number, number] | null {
  const needle = normalizeSearchText(term)
  if (needle === '') return null

  const folded = foldWithOrigins(name)
  const at = folded.text.indexOf(needle)
  if (at < 0) return null

  const start = folded.starts[at]
  const end = folded.ends[at + needle.length - 1]
  return start === undefined || end === undefined ? null : [start, end]
}
