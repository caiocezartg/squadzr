/**
 * The shared tag schema words its two limits in English (packages/schemas). The form shows the
 * translation of each limit it knows, and any other message as the schema wrote it.
 */
const TAG_ERROR_KEYS = {
  'Max 5 tags': 'squads.createModal.tagsMax',
  'Tag too long': 'squads.createModal.tagTooLong',
} as const

type TagErrorMessage = keyof typeof TAG_ERROR_KEYS
type TagErrorKey = (typeof TAG_ERROR_KEYS)[TagErrorMessage]

function isTagErrorMessage(message: string): message is TagErrorMessage {
  return Object.hasOwn(TAG_ERROR_KEYS, message)
}

/** A tag error message in the language of `t`. */
export function translateTagError(message: string, t: (key: TagErrorKey) => string): string {
  return isTagErrorMessage(message) ? t(TAG_ERROR_KEYS[message]) : message
}
