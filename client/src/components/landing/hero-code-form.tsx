'use client'

import { useId, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useAppNavigation } from '@/lib/navigation'
import { joinHref, parseSquadCode } from '@/lib/squad-links'

/**
 * The hero's join-by-code field. A valid code (six letters or digits, in either case, with or without
 * the `#`) leads to the board's invite link, which joins a signed-in viewer and asks a visitor to sign
 * in. Anything else shows its message in place and sends no request.
 */
export function HeroCodeForm() {
  const t = useTranslations('landing.hero')
  const tShell = useTranslations('ds.shell')
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
    navigate(joinHref(parsed))
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-110 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="text-text-3 text-[13px]">
          {t('codeLabel')}
        </label>
        <div className="bg-card focus-within:shadow-[inset_0_0_0_1.5px_var(--color-track)] flex min-w-50 flex-1 items-center gap-1.5 py-1 pr-1 pl-3.5">
          <span aria-hidden="true" className="font-ds-mono text-ds-muted text-[15px]">
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
            className="font-ds-mono text-text placeholder:text-faint min-w-0 flex-1 bg-transparent py-2.5 text-[15px] font-bold tracking-[0.12em] uppercase outline-none"
          />
          <button
            type="submit"
            className="press bg-track text-text hover-fine:bg-line focus-visible:outline-mint min-h-10 px-3.5 py-2.75 text-[13px] font-bold focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            {t('codeSubmit')}
          </button>
        </div>
      </div>
      {invalid && (
        <p id={messageId} role="alert" className="text-ds-danger px-1 text-xs font-semibold">
          {tShell('codeInvalid')}
        </p>
      )}
    </form>
  )
}
