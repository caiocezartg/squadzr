/**
 * The tag errors the form shows. The shared tag schema words its two limits in English, and the form
 * translates them. The first test reads the schema's own messages, so the table cannot drift from it.
 */

import { describe, expect, it } from 'vitest'
import { createTranslator } from 'next-intl'
import { createRoomInputSchema } from '@squadzr/schemas'
import en from '@/locales/en.json'
import ptBR from '@/locales/pt-BR.json'
import { translateTagError } from './tag-errors'

const t = createTranslator({ locale: 'en', messages: en })
const tPtBR = createTranslator({ locale: 'pt-BR', messages: ptBR })

function firstTagIssue(tags: string[]): string {
  const result = createRoomInputSchema.shape.tags.safeParse(tags)
  if (result.success) throw new Error('expected the tags to break the schema limit')
  return result.error.issues[0]?.message ?? ''
}

describe('translateTagError', () => {
  it('translates the limit on the number of tags, as the shared schema words it', () => {
    const message = firstTagIssue(['a', 'b', 'c', 'd', 'e', 'f'])

    expect(message).toBe('Max 5 tags')
    expect(translateTagError(message, tPtBR)).toBe('Máximo de 5 tags')
  })

  it('translates the limit on a tag length, as the shared schema words it', () => {
    const message = firstTagIssue(['x'.repeat(16)])

    expect(message).toBe('Tag too long')
    expect(translateTagError(message, tPtBR)).toBe('Tag muito longa')
    expect(translateTagError(message, t)).toBe('Tag too long')
  })

  it('shows a message the table does not name as the schema wrote it', () => {
    expect(translateTagError('Something else', tPtBR)).toBe('Something else')
  })
})
