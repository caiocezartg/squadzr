import { screen, within } from '@testing-library/react'
import { expect } from 'vitest'

/**
 * The locked invite bar as a viewer sees it while the Squad forms: a region named "Discord invite" with its
 * lock icon, what it waits for, and the masked link, which is a mask and never a character of the invite.
 */
export function expectLockedInvite(): void {
  const bar = screen.getByRole('region', { name: 'Discord invite' })

  expect(within(bar).getByText('Unlocked when the squad completes')).toBeInTheDocument()
  expect(within(bar).getByText('discord.gg/••••••••')).toBeInTheDocument()
  expect(bar.querySelector('svg.lucide-lock')).toBeInTheDocument()
}
