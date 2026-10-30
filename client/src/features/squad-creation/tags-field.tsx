import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { Tag } from '@/components/ds/tag'
import { cn } from '@/lib/utils'
import { addTag } from './add-tag'
import { CONTROL_CLASSES, CONTROL_ERROR_CLASSES } from './form-field'
import { translateTagError } from './tag-errors'

/** The longest a tag may be without its leading `#`, as the contract states it. */
const TAG_MAX_LENGTH = 12

/** The draft as far as the field takes it: its leading `#`s do not count toward the length. */
function limitDraft(text: string): string {
  const [, prefix = '', body = ''] = /^(\s*#*)([\s\S]*)$/.exec(text) ?? []
  return prefix + body.slice(0, TAG_MAX_LENGTH)
}

/** The tags the form offers as one-tap chips, in this order. */
export const TAG_SUGGESTIONS = [
  'ranked',
  'casual',
  'chill',
  'competitive',
  'mic',
  'fun',
  'tryhard',
  'premier',
] as const

export interface TagsFieldProps {
  /** The id the input carries, for the label that names it. */
  inputId: string
  value: string[]
  onChange: (tags: string[]) => void
  /** The message the form's validation gave the tags, if any. */
  formError?: string
}

/**
 * The tags of the create-Squad form: removable chips with an input and "Add" (Enter, comma and space
 * add too, Backspace on an empty input removes the last), and the suggestions not yet added.
 * The input stops taking characters at the length of a tag. The contract decides what a list may hold;
 * a tag it refuses (pasted text with spaces, say) is not added and its message shows under the field.
 */
export function TagsField({ inputId, value: tags, onChange, formError }: TagsFieldProps) {
  const t = useTranslations()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [rejection, setRejection] = useState<string | null>(null)

  const message = rejection ?? formError
  const suggestions = TAG_SUGGESTIONS.filter((suggestion) => !tags.includes(suggestion))

  const commit = (raw: string) => {
    const result = addTag(tags, raw)
    if (result.kind === 'rejected') {
      setRejection(result.message)
      return
    }

    setRejection(null)
    setDraft('')
    if (result.kind === 'added') onChange(result.tags)
  }

  const remove = (tag: string) => {
    setRejection(null)
    onChange(tags.filter((current) => current !== tag))
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault()
      commit(draft)
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      const last = tags[tags.length - 1]
      if (last) remove(last)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <div
          className={cn(
            'flex min-h-12.5 flex-wrap items-center gap-1.5 p-1.75',
            message ? CONTROL_ERROR_CLASSES : CONTROL_CLASSES
          )}
        >
          {tags.map((tag) => (
            <Tag key={tag} variant="removable" label={`#${tag}`} onClick={() => remove(tag)} />
          ))}
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(limitDraft(event.target.value))
              setRejection(null)
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errorId : undefined}
            placeholder={t('ds.createSquad.tagPlaceholder')}
            className="text-text placeholder:text-faint min-w-30 flex-1 border-0 bg-transparent px-1.5 py-2 text-sm font-medium outline-none"
          />
          <Button variant="secondary" size="sm" onClick={() => commit(draft)}>
            {t('ds.createSquad.addTag')}
          </Button>
        </div>
        <div aria-live="polite">
          {message && (
            <p id={errorId} className="text-ds-danger mt-2 text-[12.5px] leading-normal">
              {translateTagError(message, t)}
            </p>
          )}
        </div>
      </div>
      {suggestions.length > 0 && (
        <div
          role="group"
          aria-label={t('ds.createSquad.suggestedTags')}
          className="flex flex-wrap items-center gap-1.5"
        >
          {suggestions.map((suggestion) => (
            <Tag
              key={suggestion}
              variant="suggest"
              label={suggestion}
              onClick={() => commit(suggestion)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
