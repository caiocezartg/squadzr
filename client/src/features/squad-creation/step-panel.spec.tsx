/**
 * The wizard's step transition: 12px in the travel direction with opacity over 240ms `--ease-out`,
 * the movement gated behind `motion-safe` so reduced motion keeps the fade only, and no entrance for
 * the step the dialog opens on. jsdom does not run Tailwind, so the spec reads the classes.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StepPanel } from './step-panel'

function panel() {
  return screen.getByText('Content').parentElement as HTMLElement
}

describe('step panel', () => {
  it('slides in from the right when moving forward', () => {
    render(
      <StepPanel step="details" direction="forward">
        <span>Content</span>
      </StepPanel>
    )

    expect(panel()).toHaveClass(
      'transition-[opacity,translate]',
      'duration-240',
      'ease-out',
      'starting:opacity-0',
      'motion-safe:starting:translate-x-3'
    )
  })

  it('slides in from the left when moving back', () => {
    render(
      <StepPanel step="game" direction="back">
        <span>Content</span>
      </StepPanel>
    )

    expect(panel()).toHaveClass('starting:opacity-0', 'motion-safe:starting:-translate-x-3')
  })

  it('gates the movement behind motion-safe, so reduced motion only fades', () => {
    render(
      <StepPanel step="details" direction="forward">
        <span>Content</span>
      </StepPanel>
    )

    const movement = Array.from(panel().classList).filter((name) => name.includes('translate-x'))
    expect(movement.length).toBeGreaterThan(0)
    expect(movement.every((name) => name.startsWith('motion-safe:'))).toBe(true)
  })

  it('does not animate the step the dialog opens on', () => {
    render(
      <StepPanel step="game" direction={null}>
        <span>Content</span>
      </StepPanel>
    )

    expect(panel().className).not.toMatch(/starting:|transition-/)
  })

  it('clips the slide horizontally so the dialog does not flash a scrollbar', () => {
    render(
      <StepPanel step="details" direction="forward">
        <span>Content</span>
      </StepPanel>
    )

    expect(panel().parentElement).toHaveClass('overflow-x-clip')
  })

  it('bounds the step to the dialog on a phone only when it fills, so a list inside can scroll', () => {
    render(
      <StepPanel step="game" direction={null} fill>
        <span>Content</span>
      </StepPanel>
    )

    expect(panel()).toHaveClass('max-sm:min-h-72')
    expect(panel().parentElement).toHaveClass('max-sm:min-h-0')
  })

  it('keeps the natural height without fill', () => {
    render(
      <StepPanel step="details" direction={null}>
        <span>Content</span>
      </StepPanel>
    )

    expect(panel().className).not.toMatch(/min-h-72/)
    expect(panel().parentElement).not.toHaveClass('max-sm:min-h-0')
  })
})
