/**
 * The pagination: labelled previous, next and page buttons, the current page marked, the ends
 * disabled, and nothing for a single page.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './pagination'

describe('pagination', () => {
  it('names previous, next and every page, and marks the current one', () => {
    render(<Pagination page={2} pageCount={3} onPageChange={() => undefined} />)

    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toContainElement(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Page 3' })).not.toHaveAttribute('aria-current')
  })

  it('disables the previous button on the first page and the next on the last', () => {
    const { rerender } = render(
      <Pagination page={1} pageCount={3} onPageChange={() => undefined} />
    )
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()

    rerender(<Pagination page={3} pageCount={3} onPageChange={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('renders nothing for a single page', () => {
    render(<Pagination page={1} pageCount={1} onPageChange={() => undefined} />)

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('moves with Tab and goes to a page with Enter or Space, skipping a disabled end', async () => {
    const user = userEvent.setup({ delay: null })
    const onPageChange = vi.fn()
    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />)

    // The disabled previous button is not a keyboard stop.
    await user.tab()
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onPageChange).toHaveBeenLastCalledWith(2)

    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveFocus()
    await user.keyboard(' ')
    expect(onPageChange).toHaveBeenLastCalledWith(2)
  })

  it('leaves the page to its parent', async () => {
    const user = userEvent.setup({ delay: null })
    const onPageChange = vi.fn()
    render(<Pagination page={2} pageCount={3} onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    await user.click(screen.getByRole('button', { name: 'Page 3' }))

    expect(onPageChange.mock.calls).toEqual([[1], [3]])
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
  })
  describe('with many pages', () => {
    it('shows the first and last page, the current one and its neighbours, and aria-hidden ellipses', () => {
      render(<Pagination page={10} pageCount={20} onPageChange={() => undefined} />)

      const pages = screen
        .getAllByRole('button', { name: /^Page \d+$/ })
        .map((button) => button.textContent)
      expect(pages).toEqual(['1', '9', '10', '11', '20'])
      expect(screen.getByRole('button', { name: 'Page 10' })).toHaveAttribute(
        'aria-current',
        'page'
      )

      const nav = screen.getByRole('navigation', { name: 'Pagination' })
      const ellipses = nav.querySelectorAll('[data-ellipsis]')
      expect(ellipses).toHaveLength(2)
      ellipses.forEach((ellipsis) => expect(ellipsis).toHaveAttribute('aria-hidden', 'true'))
      expect(screen.queryByRole('button', { name: 'Page 5' })).not.toBeInTheDocument()
    })

    it('shows the first run of pages and a single ellipsis on the first page', () => {
      render(<Pagination page={1} pageCount={20} onPageChange={() => undefined} />)

      const pages = screen
        .getAllByRole('button', { name: /^Page \d+$/ })
        .map((button) => button.textContent)
      expect(pages).toEqual(['1', '2', '3', '4', '5', '20'])
      expect(screen.getByRole('navigation').querySelectorAll('[data-ellipsis]')).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    })

    it('disables next on the last page and goes to a far page by its button', async () => {
      const user = userEvent.setup({ delay: null })
      const onPageChange = vi.fn()
      render(<Pagination page={20} pageCount={20} onPageChange={onPageChange} />)

      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Page 1' }))
      expect(onPageChange).toHaveBeenLastCalledWith(1)
    })

    it('shows the current page of the total as plain text for narrow screens', () => {
      render(<Pagination page={10} pageCount={20} onPageChange={() => undefined} />)

      expect(screen.getByText('10 / 20')).toBeInTheDocument()
    })
  })
})
