/**
 * The dialog: a modal named by its title, with focus trapped inside, closed by Escape or its close
 * button, and focus handed back to the trigger.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(() => {
    // @ts-expect-error jsdom has no getAnimations; the exit test installs one
    delete Element.prototype.getAnimations
  })

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

  describe('transitions', () => {
    /** Every `data-*` state the popup showed, caught by a MutationObserver between two assertions. */
    function watchPopupStates(): { states: Set<string>; stop: () => void } {
      const states = new Set<string>()
      const record = () => {
        const popup = document.querySelector('[role="dialog"]')
        for (const name of popup?.getAttributeNames() ?? []) {
          if (name.endsWith('-style')) states.add(name)
        }
      }
      const observer = new MutationObserver(record)
      observer.observe(document.body, { subtree: true, childList: true, attributes: true })
      return { states, stop: () => observer.disconnect() }
    }

    it('plays the enter of a dialog its parent mounts already open', async () => {
      const watcher = watchPopupStates()
      render(
        <Dialog title="Create squad" open>
          <p>Content</p>
        </Dialog>
      )

      await screen.findByRole('dialog', { name: 'Create squad' })
      await waitFor(() =>
        expect(screen.getByRole('dialog')).not.toHaveAttribute('data-starting-style')
      )
      watcher.stop()

      expect(watcher.states).toContain('data-starting-style')
    })

    it('is not rendered by the first render of a parent-driven dialog', () => {
      const { container } = render(
        <Dialog title="Create squad" open>
          <p>Content</p>
        </Dialog>
      )

      // The first paint is closed: the open state arrives with the first effect.
      expect(container).toBeEmptyDOMElement()
    })

    it('stays through its exit and reports it once the transition has finished', async () => {
      // jsdom runs no transitions: hold the exit open the way a running transition does.
      let finishExit!: () => void
      const exit = new Promise<void>((resolve) => {
        finishExit = resolve
      })
      let holding = false
      Element.prototype.getAnimations = () =>
        holding ? [{ finished: exit } as unknown as Animation] : []
      const onOpenChangeComplete = vi.fn()
      const { rerender } = render(
        <Dialog title="Create squad" open onOpenChangeComplete={onOpenChangeComplete}>
          <p>Content</p>
        </Dialog>
      )
      await screen.findByRole('dialog')
      await waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(true))
      onOpenChangeComplete.mockClear()
      holding = true

      rerender(
        <Dialog title="Create squad" open={false} onOpenChangeComplete={onOpenChangeComplete}>
          <p>Content</p>
        </Dialog>
      )

      await waitFor(() =>
        expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('data-ending-style')
      )
      expect(onOpenChangeComplete).not.toHaveBeenCalled()

      finishExit()

      await waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(false))
      expect(onOpenChangeComplete).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument()
    })
  })
})
