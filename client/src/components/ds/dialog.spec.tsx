/**
 * The dialog: a modal named by its title, with focus trapped inside, closed by Escape or its close
 * button, and focus handed back to the trigger.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './dialog'

function Settings({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <>
      <button type="button">Outside</button>
      <Dialog
        title="Create squad"
        trigger={<button type="button">Open dialog</button>}
        onOpenChange={onOpenChange}
      >
        <div className="p-6">
          <button type="button">First</button>
          <button type="button">Last</button>
        </div>
      </Dialog>
    </>
  )
}

describe('dialog', () => {
  it('opens from its trigger as a modal dialog named by its title', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Settings />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open dialog' }))

    const dialog = await screen.findByRole('dialog', { name: 'Create squad' })
    expect(dialog).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Create squad' })).toBeVisible()
  })

  it('traps focus inside while open', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Settings />)

    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    const dialog = await screen.findByRole('dialog')

    const outside = screen.getByRole('button', { name: 'Outside', hidden: true })
    // Tab and Shift+Tab past either end of the dialog: Base UI's focus guards send focus back in.
    for (const shift of [false, true]) {
      for (let press = 0; press < 8; press += 1) {
        await user.tab({ shift })
        expect(outside).not.toHaveFocus()
        await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
      }
    }
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Settings />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })

    await user.click(trigger)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('closes from its close button', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Settings />)

    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('stays open when the parent cancels the close, and closes again afterwards', async () => {
    const user = userEvent.setup({ delay: null })
    const onOpenChange = vi.fn((open: boolean, details: { cancel: () => void }) => {
      if (!open && onOpenChange.mock.calls.length === 2) details.cancel()
    })
    render(
      <Dialog
        title="Create squad"
        trigger={<button type="button">Open dialog</button>}
        onOpenChange={onOpenChange}
      >
        <p>Content</p>
      </Dialog>
    )

    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Create squad' })).toBeVisible()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('can be driven by its parent without a trigger', async () => {
    const user = userEvent.setup({ delay: null })
    const onOpenChange = vi.fn()
    render(
      <Dialog title="Create squad" open onOpenChange={onOpenChange}>
        <p>Content</p>
      </Dialog>
    )

    expect(await screen.findByRole('dialog', { name: 'Create squad' })).toBeVisible()
    await user.keyboard('{Escape}')

    expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([false])
  })
})
