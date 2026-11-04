/**
 * Folds a name or a search term to the form Game Search compares: accents,
 * case and punctuation do not matter. "Counter-Strike 2" and "counter strike 2"
 * fold to the same text, and a term made only of punctuation folds to "".
 *
 * The server stores and compares games with this fold, and the client uses it to
 * filter the squad board and to highlight the part of a name a term matches.
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
