/**
 * The page window: which page numbers and ellipses the pagination shows. Few pages show every
 * number; many pages keep a constant seven slots so the control keeps its width while paging.
 */

import { describe, expect, it } from 'vitest'
import { pageWindow } from './pagination-window'

const E = 'ellipsis'

describe('pageWindow', () => {
  it('shows the only page of a single page', () => {
    expect(pageWindow(1, 1)).toEqual([1])
  })

  it('shows every page for two pages', () => {
    expect(pageWindow(2, 2)).toEqual([1, 2])
  })

  it('shows every page up to seven, wherever the current page is', () => {
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(pageWindow(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('shows the pages next to the start with a single ellipsis before the last page', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, E, 20])
    expect(pageWindow(2, 20)).toEqual([1, 2, 3, 4, 5, E, 20])
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, E, 20])
  })

  it('shows the pages next to the end with a single ellipsis after the first page', () => {
    expect(pageWindow(20, 20)).toEqual([1, E, 16, 17, 18, 19, 20])
    expect(pageWindow(19, 20)).toEqual([1, E, 16, 17, 18, 19, 20])
    expect(pageWindow(17, 20)).toEqual([1, E, 16, 17, 18, 19, 20])
  })

  it('shows the current page with a neighbour on each side and an ellipsis on both gaps', () => {
    expect(pageWindow(5, 20)).toEqual([1, E, 4, 5, 6, E, 20])
    expect(pageWindow(10, 20)).toEqual([1, E, 9, 10, 11, E, 20])
    expect(pageWindow(16, 20)).toEqual([1, E, 15, 16, 17, E, 20])
  })

  it('shows a page instead of an ellipsis that would hide a single page', () => {
    // Page 7 is the only one the right gap would hide.
    expect(pageWindow(5, 8)).toEqual([1, E, 4, 5, 6, 7, 8])
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, E, 8])
  })

  it('keeps seven slots for eight pages or more', () => {
    for (const pageCount of [8, 9, 12, 20, 100]) {
      for (let current = 1; current <= pageCount; current += 1) {
        expect(pageWindow(current, pageCount)).toHaveLength(7)
      }
    }
  })
})
