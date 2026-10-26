/**
 * The step indicator: a labelled item per step, finished steps announced as completed, and the
 * current step marked.
 */

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Steps } from './steps'

const steps = ['01 · GAME', '02 · DETAILS', '03 · DISCORD']

describe('steps', () => {
  it('lists the steps by label and marks the current one', () => {
    render(<Steps steps={steps} current={2} label="Create squad" />)

    const list = screen.getByRole('list', { name: 'Create squad' })
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      '01 · GAMECompleted',
      '02 · DETAILS',
      '03 · DISCORD',
    ])
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null])
  })

  it('announces only the finished steps as completed', () => {
    render(<Steps steps={steps} current={3} />)

    const [first, second, third] = screen.getAllByRole('listitem')
    expect(within(first!).getByText('Completed')).toBeInTheDocument()
    expect(within(second!).getByText('Completed')).toBeInTheDocument()
    expect(within(third!).queryByText('Completed')).not.toBeInTheDocument()
    expect(third).toHaveAttribute('aria-current', 'step')
  })

  it('has no completed step on the first one', () => {
    render(<Steps steps={steps} current={1} />)

    expect(screen.queryByText('Completed')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step')
  })
})
