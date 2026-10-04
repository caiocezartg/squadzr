const DEFAULT_PAGE_SIZE = 6

interface UsePaginationOptions {
  totalItems: number
  pageSize?: number
  currentPage: number
  onPageChange: (page: number) => void
}

interface UsePaginationReturn {
  currentPage: number
  totalPages: number
  startIndex: number
  endIndex: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  goToPage: (page: number) => void
  nextPage: () => void
  previousPage: () => void
  pageRange: number[]
}

export function usePagination({
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  currentPage,
  onPageChange,
}: UsePaginationOptions): UsePaginationReturn {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Clamp current page if totalPages shrinks (e.g., filter changes reduce results)
  const safePage = Math.min(currentPage, totalPages)

  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages))
    onPageChange(clamped)
  }

  const nextPage = () => goToPage(safePage + 1)
  const previousPage = () => goToPage(safePage - 1)

  // Generate page numbers to display.
  // For <= 7 pages show all; otherwise show first, last, current +-1 with gaps.
  let pageRange: number[]
  if (totalPages <= 7) {
    pageRange = Array.from({ length: totalPages }, (_, i) => i + 1)
  } else {
    const pages = new Set<number>()
    pages.add(1)
    pages.add(totalPages)
    pages.add(safePage)
    if (safePage > 1) pages.add(safePage - 1)
    if (safePage < totalPages) pages.add(safePage + 1)
    pageRange = Array.from(pages).sort((a, b) => a - b)
  }

  return {
    currentPage: safePage,
    totalPages,
    startIndex,
    endIndex,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    goToPage,
    nextPage,
    previousPage,
    pageRange,
  }
}
