import { useState, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Tag } from '@/components/ds/tag'
import { normalizeTag } from '@/features/squad-list'

interface TagFilterProps {
  /** The tag toggles: the board's most used tags, then any selected tag that ranks lower. */
  readonly options: readonly string[]
  readonly selected: readonly string[]
  readonly onToggle: (tag: string) => void
}

/**
 * The tags control of the filters panel: a free-text field that selects the tag typed (Enter or a
 * comma), and the toggles of the tags the board uses most. A Squad must have every selected tag.
 */
export function TagFilter({ options, selected, onToggle }: TagFilterProps) {
  const t = useTranslations('ds.board')
  const [text, setText] = useState('')

  const addTyped = () => {
    const tag = normalizeTag(text)
    if (tag !== '' && !selected.includes(tag)) onToggle(tag)
    setText('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    addTyped()
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="type-label text-ds-muted">{t('tags')}</span>
      <span className="bg-panel focus-within:shadow-[inset_0_0_0_1.5px_var(--color-mint)] flex min-h-11 items-center gap-2 px-3.5">
        <span aria-hidden="true" className="font-ds-mono text-ds-muted">
          #
        </span>
        <input
          id="board-tag-filter"
          type="text"
          value={text}
          aria-label={t('tagLabel')}
          placeholder={t('tagPlaceholder')}
          autoComplete="off"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          className="text-text placeholder:text-faint font-body min-w-0 flex-1 border-0 bg-transparent text-sm font-medium outline-none"
        />
      </span>
      <div role="group" aria-label={t('tags')} className="flex flex-wrap gap-1.5">
        {options.map((tag) => (
          <Tag
            key={tag}
            variant="toggle"
            label={tag}
            pressed={selected.includes(tag)}
            onClick={() => onToggle(tag)}
          />
        ))}
      </div>
    </div>
  )
}
