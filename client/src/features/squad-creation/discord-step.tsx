'use client'

import { useId } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Check, Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DiscordIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import type { Game } from '@/types'
import type { FormInput, FormValues } from './create-squad-form'
import { checkDiscordLink } from './discord-link'
import { FormField } from './form-field'
import { SquadPreview } from './squad-preview'

/**
 * Step 3: the Discord invite with live validation by the contract's own rule, a hint about who sees
 * it, and a preview of the Squad's card. The mark and the message follow what the player has typed;
 * an empty field says nothing until the form is submitted.
 */
export function DiscordStep({ game }: { game: Game }) {
  const t = useTranslations()
  const inputId = useId()
  const errorId = useId()
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormInput, unknown, FormValues>()
  const link = useWatch({ control, name: 'discordLink' }) ?? ''

  const check = checkDiscordLink(link)
  const valid = link !== '' && check.valid
  const showsError = !check.valid && (link !== '' || errors.discordLink !== undefined)
  const errorMessage =
    showsError && !check.valid ? t(`squads.createModal.${check.errorKey}`) : undefined

  return (
    <>
      <div className="flex flex-col gap-2">
        <FormField
          htmlFor={inputId}
          label={t('ds.createSquad.discordLabel')}
          errorId={errorId}
          error={errorMessage}
        >
          <span
            className={cn(
              'flex min-h-13 items-center gap-2.5 bg-[#0c0d10] px-3.5',
              valid
                ? 'shadow-[inset_0_0_0_1.5px_var(--color-mint)]'
                : showsError
                  ? 'shadow-[inset_0_0_0_1.5px_var(--color-ds-danger)]'
                  : 'shadow-[inset_0_0_0_1.5px_var(--color-track)] focus-within:shadow-[inset_0_0_0_1.5px_var(--color-mint)]'
            )}
          >
            <DiscordIcon aria-hidden className="text-discord-soft size-4.5 shrink-0" />
            <input
              id={inputId}
              type="url"
              autoComplete="off"
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={errorMessage ? errorId : undefined}
              placeholder={t('ds.createSquad.discordPlaceholder')}
              className="text-text placeholder:text-faint font-ds-mono min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold outline-none"
              {...register('discordLink')}
            />
            {valid && (
              <span className="font-ds-mono text-mint inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold">
                <Check aria-hidden className="size-3" strokeWidth={3.2} />
                {t('ds.createSquad.discordValid')}
              </span>
            )}
          </span>
        </FormField>
        <p role="status" className="sr-only">
          {valid ? t('ds.createSquad.discordValidAnnouncement') : ''}
        </p>
        <p className="text-text-3 flex gap-2 text-[12.5px] leading-normal">
          <Lock aria-hidden className="text-ds-muted mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} />
          {t('ds.createSquad.discordHint')}
        </p>
      </div>

      <SquadPreview game={game} />
    </>
  )
}
