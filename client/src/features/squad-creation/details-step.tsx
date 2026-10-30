'use client'

import { useId } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { Segmented } from '@/components/ds/segmented'
import { languageBadgeKey } from '@/lib/language-badge'
import { cn } from '@/lib/utils'
import type { Game } from '@/types'
import {
  NAME_MAX_LENGTH,
  PLAYER_LIMITS,
  defaultPlayers,
  type FormInput,
  type FormValues,
} from './create-squad-form'
import { GameCover } from './game-option'
import { CONTROL_CLASSES, CONTROL_ERROR_CLASSES, FormField } from './form-field'
import { PlayerStepper } from './player-stepper'
import { TagsField } from './tags-field'

const languageValues = ['pt-br', 'en'] as const

export interface DetailsStepProps {
  selectedGame: Game
  /** Returns to the game step; the form keeps every value. */
  onChangeGame: () => void
}

/**
 * Step 2: the chosen game with "Change game", the name with its counter, the player stepper, the
 * Squad language and the tags with their suggestions. Every control writes to the wizard's form.
 */
export function DetailsStep({ selectedGame, onChangeGame }: DetailsStepProps) {
  const t = useTranslations()
  const ids = {
    name: useId(),
    nameError: useId(),
    players: useId(),
    tags: useId(),
  }
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormInput, unknown, FormValues>()
  const name = useWatch({ control, name: 'name' }) ?? ''

  const nameError = errors.name
    ? errors.name.type === 'too_small'
      ? t('squads.createModal.nameRequired')
      : t('squads.createModal.nameTooLong')
    : undefined

  return (
    <>
      <div className="flex items-center gap-3 bg-[#0c0d10] p-2">
        <GameCover game={selectedGame} />
        <span className="font-ds-mono min-w-0 flex-1 truncate text-xs font-bold tracking-widest uppercase">
          {selectedGame.name}
        </span>
        <Button variant="secondary" size="sm" onClick={onChangeGame}>
          {t('ds.createSquad.changeGame')}
        </Button>
      </div>

      <FormField
        htmlFor={ids.name}
        label={t('ds.createSquad.nameLabel')}
        aside={
          <span
            className={cn(
              'font-ds-mono text-[11px] tabular-nums',
              name.length > NAME_MAX_LENGTH ? 'text-ds-danger' : 'text-ds-muted'
            )}
          >
            {name.length}/{NAME_MAX_LENGTH}
          </span>
        }
        errorId={ids.nameError}
        error={nameError}
      >
        <input
          id={ids.name}
          type="text"
          autoComplete="off"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? ids.nameError : undefined}
          placeholder={t('ds.createSquad.namePlaceholder')}
          className={cn(
            'text-text placeholder:text-faint min-h-12.5 w-full border-0 px-4 text-[15px] font-semibold outline-none',
            nameError ? CONTROL_ERROR_CLASSES : CONTROL_CLASSES
          )}
          {...register('name')}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField labelId={ids.players} label={t('ds.createSquad.playersLabel')}>
          <Controller
            name="maxPlayers"
            control={control}
            render={({ field }) => (
              <PlayerStepper
                labelledBy={ids.players}
                value={field.value ?? defaultPlayers(selectedGame)}
                min={PLAYER_LIMITS.min}
                max={PLAYER_LIMITS.max}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>

        <FormField label={t('ds.createSquad.languageLabel')}>
          <Controller
            name="language"
            control={control}
            render={({ field }) => (
              <Segmented
                label={t('ds.createSquad.languageLabel')}
                fluid
                options={languageValues.map((value) => ({
                  value,
                  label: t(languageBadgeKey(value)),
                }))}
                value={field.value ?? 'pt-br'}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
      </div>

      <FormField
        htmlFor={ids.tags}
        label={
          <>
            {t('ds.createSquad.tagsLabel')}{' '}
            <span className="text-ds-muted font-medium">{t('ds.createSquad.optional')}</span>
          </>
        }
      >
        <Controller
          name="tags"
          control={control}
          render={({ field }) => (
            <TagsField
              inputId={ids.tags}
              value={field.value ?? []}
              onChange={field.onChange}
              formError={errors.tags?.message}
            />
          )}
        />
      </FormField>
    </>
  )
}
