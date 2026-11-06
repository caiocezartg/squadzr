/** A slot of the page window: a page number, or the ellipsis standing for hidden pages. */
export type PageWindowItem = number | 'ellipsis'

/** Up to this many pages every number is shown; from one more, the window is `SLOTS` wide. */
const SLOTS = 7
/** How many pages the window shows next to an end before its ellipsis. */
const END_RUN = 5

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}

/**
 * The page numbers and ellipses to show for `current` (from 1) of `pageCount` pages: the first and
 * last page, the current page with a neighbour on each side, and an ellipsis for each gap. The
 * window is a constant seven slots, so a gap hiding a single page shows that page instead and the
 * control keeps its width while paging.
 */
export function pageWindow(current: number, pageCount: number): PageWindowItem[] {
  if (pageCount <= SLOTS) return range(1, pageCount)

  if (current <= END_RUN - 1) return [...range(1, END_RUN), 'ellipsis', pageCount]
  if (current >= pageCount - (END_RUN - 2)) {
    return [1, 'ellipsis', ...range(pageCount - (END_RUN - 1), pageCount)]
  }

  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', pageCount]
}
