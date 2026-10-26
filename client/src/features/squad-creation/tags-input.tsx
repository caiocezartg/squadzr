import { useState, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

export interface TagsInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  onBlur: () => void
  hasError: boolean
}

/**
 * The tags of the create-Squad form: chips the player adds with Enter or a comma and removes with
 * their own button or Backspace. It caps the list at five unique tags and keeps the raw text until
 * a tag is committed.
 */
export function TagsInput({ value: tags, onChange, onBlur, hasError }: TagsInputProps) {
  const t = useTranslations()
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const atLimit = tags.length >= 5

  const addTag = (raw: string) => {
    const tag = raw.replace(/^#+/, '').trim().toLowerCase()
    if (!tag || atLimit || tags.includes(tag)) return
    onChange([...tags, tag])
  }

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
      setInputValue('')
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (value.endsWith(',')) {
      addTag(value.slice(0, -1))
      setInputValue('')
      return
    }

    setInputValue(value)
  }

  return (
    <div
      className={`input-field flex min-h-11 cursor-text flex-wrap items-center gap-2 ${
        hasError ? 'border-danger/50 focus-within:border-danger/70 focus-within:ring-danger/20' : ''
      }`}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md border border-border-light bg-surface-light px-2 py-0.5 text-xs text-offwhite"
        >
          #{tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(tags.indexOf(tag))
            }}
            className="ml-0.5 flex items-center justify-center text-muted transition-colors hover:text-offwhite"
            aria-label={t('squads.createModal.removeTag', { tag })}
          >
            <X className="size-2.5" strokeWidth={3} />
          </button>
        </span>
      ))}

      {!atLimit && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          maxLength={15}
          className="min-w-24 flex-1 bg-transparent text-sm text-offwhite outline-hidden placeholder:text-muted/60"
          placeholder={
            tags.length === 0
              ? t('squads.createModal.tagsPlaceholder')
              : t('squads.createModal.tagsPlaceholderMore')
          }
          aria-label={t('squads.createModal.addTag')}
        />
      )}
    </div>
  )
}
