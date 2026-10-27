'use client'

import { Controller, useFormContext } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { languageBadgeKey } from '@/lib/language-badge'
import type { Game } from '@/types'
import type { FormInput, FormValues } from './create-squad-form'
import { FormField } from './form-field'
import { TagsInput } from './tags-input'
import { translateTagError } from './tag-errors'

const languageOptions = ['pt-br', 'en'] as const

/** Step 2: today's name, player limit, tags and language fields. */
export function DetailsStep({ selectedGame }: { selectedGame: Game | null }) {
  const t = useTranslations()
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormInput, unknown, FormValues>()

  const maxPlayersHelperText = selectedGame
    ? t('squads.createModal.playerLimitHelperWithGame', {
        maxPlayers: selectedGame.maxPlayers,
        gameName: selectedGame.name,
      })
    : t('squads.createModal.playerLimitHelper')

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <FormField
        htmlFor="modal-squadName"
        label={t('squads.createModal.squadName')}
        error={
          errors.name
            ? errors.name.type === 'too_small'
              ? t('squads.createModal.nameRequired')
              : t('squads.createModal.nameTooLong')
            : undefined
        }
        className="lg:col-span-2"
      >
        <input
          id="modal-squadName"
          type="text"
          className={errors.name ? 'input-field-error' : 'input-field'}
          placeholder={t('squads.createModal.squadNamePlaceholder')}
          {...register('name')}
        />
      </FormField>

      <div className="space-y-1.5 lg:col-span-2">
        <FormField
          htmlFor="modal-maxPlayers"
          label={
            <>
              {t('squads.createModal.playerLimit')}{' '}
              <span className="font-normal text-muted">{t('squads.createModal.optional')}</span>
            </>
          }
          error={
            errors.maxPlayers
              ? errors.maxPlayers.type === 'too_small'
                ? t('squads.createModal.maxPlayersTooFew')
                : t('squads.createModal.maxPlayersTooMany')
              : undefined
          }
        >
          <input
            id="modal-maxPlayers"
            type="number"
            className={errors.maxPlayers ? 'input-field-error' : 'input-field'}
            min={2}
            max={40}
            placeholder={selectedGame?.maxPlayers?.toString() ?? ''}
            {...register('maxPlayers', {
              setValueAs: (value: string) =>
                value === '' || isNaN(Number(value)) ? undefined : Number(value),
            })}
          />
        </FormField>
        <p className="text-xs text-muted">{maxPlayersHelperText}</p>
      </div>

      <FormField
        label={
          <>
            {t('squads.createModal.tags')}{' '}
            <span className="font-normal text-muted">{t('squads.createModal.optional')}</span>
          </>
        }
        hint={t('squads.createModal.tagsHelper')}
        error={errors.tags?.message ? translateTagError(errors.tags.message, t) : undefined}
        className="lg:col-span-2"
      >
        <Controller
          name="tags"
          control={control}
          render={({ field }) => (
            <TagsInput
              value={field.value ?? []}
              onChange={field.onChange}
              onBlur={field.onBlur}
              hasError={!!errors.tags}
            />
          )}
        />
      </FormField>

      <FormField
        label={t('squads.createModal.language')}
        error={errors.language?.message}
        className="lg:col-span-2"
      >
        <Controller
          name="language"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {languageOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => field.onChange(value)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    field.value === value
                      ? 'border border-accent/20 bg-accent/10 text-accent'
                      : 'border border-border bg-surface text-muted hover:border-border-light hover:text-offwhite'
                  }`}
                >
                  {t(languageBadgeKey(value))}
                </button>
              ))}
            </div>
          )}
        />
      </FormField>
    </div>
  )
}
