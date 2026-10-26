'use client'

import { useId, useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAppNavigation } from '@/lib/navigation'
import { joinHref, parseSquadCode } from '@/lib/squad-links'
import { cn } from '@/lib/utils'

interface SidebarCodeFormProps {
  /** Called once the code leads to the board's invite link. */
  readonly onNavigate?: () => void
}

/**
 * The join-by-code form. A valid code (six letters or digits, in either case) leads to the board's
 * invite link, which joins a signed-in viewer and asks a visitor to sign in. Anything else shows its
 * message in place and sends no request.
 */
export function SidebarCodeForm({ onNavigate }: SidebarCodeFormProps) {
  const t = useTranslations('ds.shell')
  const navigate = useAppNavigation()
  const inputId = useId()
  const messageId = useId()
  const [code, setCode] = useState('')
  const [invalid, setInvalid] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = parseSquadCode(code)
    setInvalid(parsed === null)
    if (parsed === null) return

    setCode('')
    onNavigate?.()
    navigate(joinHref(parsed))
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="bg-card focus-within:shadow-[inset_0_0_0_1.5px_var(--color-track)] flex items-center gap-1.5 py-[3px] pr-[3px] pl-3">
        <label htmlFor={inputId} className="sr-only">
          {t('codeLabel')}
        </label>
        <span aria-hidden="true" className="font-ds-mono text-ds-muted text-[13px]">
          #
        </span>
        <input
          id={inputId}
          type="text"
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
            setInvalid(false)
          }}
          placeholder={t('codePlaceholder')}
          maxLength={7}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={invalid ? messageId : undefined}
          className="font-ds-mono text-text placeholder:text-faint min-w-0 flex-1 bg-transparent py-2.5 text-[13px] font-bold tracking-[0.1em] uppercase outline-none"
        />
        <button
          type="submit"
          aria-label={t('codeSubmit')}
          className={cn(
            'press bg-line text-text hover-fine:bg-track focus-visible:outline-mint flex size-[38px] shrink-0 items-center justify-center',
            'focus-visible:outline-2 focus-visible:-outline-offset-2'
          )}
        >
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={2.6} />
        </button>
      </div>
      {invalid && (
        <p id={messageId} role="alert" className="text-ds-danger mt-2 px-1 text-xs font-semibold">
          {t('codeInvalid')}
        </p>
      )}
    </form>
  )
}
