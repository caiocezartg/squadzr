/**
 * The popover and its bottom sheet: opened from the trigger, named by its title, closed at once by
 * Escape with focus back on the trigger. Below 640px a popover can render as the sheet.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockMediaQuery } from '@/test/media-query'
import { Popover } from './popover'
import { NARROW_QUERY } from './use-media-query'

function Filters({ bottomSheet = false }: { bottomSheet?: boolean }) {
  return (
    <Popover
      title="Filters"
      bottomSheet={bottomSheet}
      trigger={<button type="button">Open filters</button>}
    >
      <button type="button">Apply</button>
    </Popover>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('popover', () => {
  it('opens from its trigger as a dialog named by its title', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Filters />)
    const trigger = screen.getByRole('button', { name: 'Open filters' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(trigger)

    expect(await screen.findByRole('dialog', { name: 'Filters' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeVisible()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes at once on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Filters />)
    const trigger = screen.getByRole('button', { name: 'Open filters' })

    await user.click(trigger)
    await screen.findByRole('dialog', { name: 'Filters' })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens and closes from the keyboard', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Filters />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Open filters' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: 'Filters' })).toBeVisible()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open filters' })).toHaveFocus()
  })

  it('reports the open state to its parent', async () => {
    const user = userEvent.setup({ delay: null })
    const onOpenChange = vi.fn()
    render(
      <Popover
        title="Filters"
        trigger={<button type="button">Open filters</button>}
        onOpenChange={onOpenChange}
      >
        <p>Content</p>
      </Popover>
    )

    await user.click(screen.getByRole('button', { name: 'Open filters' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    await waitFor(() =>
      expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true, false])
    )
  })
})

describe('popover as a bottom sheet', () => {
  it('stays a popover on wide screens', async () => {
    const user = userEvent.setup({ delay: null })
    mockMediaQuery(NARROW_QUERY, false)
    render(<Filters bottomSheet />)

    await user.click(screen.getByRole('button', { name: 'Open filters' }))

    expect(await screen.findByRole('dialog', { name: 'Filters' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('renders a sheet below 640px, with the same props, that Escape closes and gives focus back', async () => {
    const user = userEvent.setup({ delay: null })
    mockMediaQuery(NARROW_QUERY, true)
    render(<Filters bottomSheet />)
    const trigger = screen.getByRole('button', { name: 'Open filters' })

    await user.click(trigger)

    expect(await screen.findByRole('dialog', { name: 'Filters' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeVisible()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('closes from its close button', async () => {
    const user = userEvent.setup({ delay: null })
    mockMediaQuery(NARROW_QUERY, true)
    render(<Filters bottomSheet />)

    await user.click(screen.getByRole('button', { name: 'Open filters' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
