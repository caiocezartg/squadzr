/**
 * The reduced-motion block of the global styles. jsdom does not run Tailwind, so the spec reads the
 * block's rules from the source: what it checks is which properties the transitions and loops keep.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const MOVEMENT_PROPERTIES = ['transform', 'translate', 'scale', 'rotate', 'height', 'width']

const css = readFileSync(path.resolve(__dirname, 'globals.css'), 'utf8')

/** The text between the braces that open at `start`, nested braces included. */
function balancedBlock(source: string, start: number): string {
  let depth = 0
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start + 1, index)
  }
  throw new Error('Unbalanced braces in globals.css')
}

function reducedMotionBlock(): string {
  const header = '@media (prefers-reduced-motion: reduce)'
  const start = css.indexOf(header)
  if (start === -1) throw new Error('No reduced-motion block in globals.css')
  return balancedBlock(css, css.indexOf('{', start))
}

/** The declarations of the rule whose selector list contains `selector`. */
function declarationsOf(block: string, selector: string): string {
  const rule = new RegExp(`(?:^|[}\\n])\\s*([^{}]*${escape(selector)}[^{}]*)\\{([^{}]*)\\}`)
  const match = rule.exec(block)
  if (!match) throw new Error(`No rule for ${selector} in the reduced-motion block`)
  return match[2] ?? ''
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function transitionProperties(declarations: string): string[] {
  const value = /transition-property:([^;]*);/.exec(declarations)?.[1] ?? ''
  return value.split(',').map((property) => property.trim())
}

describe('reduced motion styles', () => {
  const block = reducedMotionBlock()

  it.each(['.transition', '.transition-all', "[class*='transition-[']"])(
    'keeps no movement property in the transitions of %s',
    (selector) => {
      const properties = transitionProperties(declarationsOf(block, selector))

      expect(properties).toEqual(expect.arrayContaining(['opacity', 'background-color']))
      for (const movement of MOVEMENT_PROPERTIES) {
        expect(properties).not.toContain(movement)
      }
    }
  )

  it('keeps visibility in the arbitrary transitions, so a fade that hides an element still plays', () => {
    const properties = transitionProperties(declarationsOf(block, "[class*='transition-[']"))

    expect(properties).toContain('visibility')
  })

  it('removes the transform transition', () => {
    expect(declarationsOf(block, '.transition-transform')).toContain('transition-property: none')
  })

  it.each([
    '.animate-spin',
    '.animate-ping',
    '.animate-bounce',
    '.animate-pulse',
    '.animate-pulse-glow',
  ])('does not run the loop %s', (selector) => {
    expect(declarationsOf(block, selector)).toContain('animation: none')
  })

  it('does not turn the finite animations into single plays of the loops', () => {
    expect(block).not.toContain('animation-iteration-count')
  })
})
