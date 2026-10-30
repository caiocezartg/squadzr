import { formSchema } from './create-squad-form'

export type AddTagResult =
  /** The tag is blank or already there: nothing to add and nothing to say. */
  | { readonly kind: 'ignored' }
  /** The contract refuses the list with the tag in it; `message` is the schema's own. */
  | { readonly kind: 'rejected'; readonly message: string }
  | { readonly kind: 'added'; readonly tags: string[] }

/**
 * Adds what the player typed to the tags. The text becomes a tag the way the contract writes it
 * (no `#`, lowercase), and the contract decides whether the list may hold it, so the 5-tag and
 * 15-character limits live only in the schema.
 */
export function addTag(tags: readonly string[], raw: string): AddTagResult {
  const tag = raw.trim().replace(/^#+/, '').trim().toLowerCase()
  if (tag === '' || tags.includes(tag)) return { kind: 'ignored' }

  const result = formSchema.shape.tags.safeParse([...tags, tag])
  if (!result.success) {
    return { kind: 'rejected', message: result.error.issues[0]?.message ?? '' }
  }

  return { kind: 'added', tags: result.data }
}
