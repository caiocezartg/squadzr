import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('joins class names and drops falsy inputs', () => {
    expect(cn('px-2', false && 'py-1', 'text-sm')).toBe('px-2 text-sm')
  })

  it('resolves conflicting Tailwind classes with the last value', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('runs inside the jsdom environment', () => {
    expect(typeof document).toBe('object')
  })
})
