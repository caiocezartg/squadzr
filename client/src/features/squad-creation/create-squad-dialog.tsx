'use client'

import { useState, type FormEvent } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Dialog } from '@/components/ds/dialog'
import { Steps } from '@/components/ds/steps'
import { getUserFriendlyError } from '@/lib/error-messages'
import { notifyError } from '@/lib/notify'
import type { Game, Squad } from '@/types'
import {
  DETAIL_FIELDS,
  STEPS,
  defaultPlayers,
  type Step,
  formSchema,
  type FormInput,
  type FormValues,
} from './create-squad-form'
import { DetailsStep } from './details-step'
import { DiscordStep } from './discord-step'
import { CreateSquadFooter } from './footer'
import { GameStep } from './game-step'
import { StepPanel, type StepDirection } from './step-panel'
import { useCreateSquad } from './use-create-squad'

export interface CreateSquadDialogProps {
  /** Dismisses the dialog; the caller unmounts it, so the next open starts from an empty form. */
  onClose: () => void
  /**
   * Called with the new squad after the board refresh was requested and
   * before navigating to its lobby, so the caller can refresh its own data.
   */
  onCreated?: (squad: Squad) => void
}

/**
 * The create-Squad wizard: three steps in the shared dialog (game, details, Discord invite). The
 * form values are inferred from the shared contract and live across steps, through "Back" and
 * "Change game" too; "Continue" validates the step it leaves, and the last step creates the Squad. The creation mutation, its typed errors, the
 * board refresh and the navigation to the new lobby stay internal. Callers mount the dialog while
 * it is open.
 */
export function CreateSquadDialog({ onClose, onCreated }: CreateSquadDialogProps) {
  const t = useTranslations('ds.createSquad')
  const tAll = useTranslations()
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      gameId: '',
      maxPlayers: undefined,
      discordLink: '',
      tags: [],
      language: 'pt-br',
    },
  })
  const createSquad = useCreateSquad({ onClose, onCreated })

  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState<StepDirection | null>(null)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [searchOwnsEscape, setSearchOwnsEscape] = useState(false)

  const step: Step = STEPS[stepIndex] ?? 'game'
  const first = stepIndex === 0
  const last = stepIndex === STEPS.length - 1

  const goTo = (index: number) => {
    setDirection(index > stepIndex ? 'forward' : 'back')
    setStepIndex(index)
  }

  // A different game starts the player stepper from its own maximum; choosing the same game again
  // keeps the count the player set.
  const selectGame = (game: Game) => {
    if (selectedGame?.id !== game.id) form.setValue('maxPlayers', defaultPlayers(game))
    setSelectedGame(game)
    form.setValue('gameId', game.id, { shouldValidate: form.formState.isSubmitted })
  }

  const create = form.handleSubmit(async (data) => {
    try {
      await createSquad.mutateAsync(data)
    } catch (err) {
      notifyError(getUserFriendlyError(err, tAll))
    }
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (last) return create(event)

    event.preventDefault()
    if (step === 'game') {
      if (selectedGame) goTo(stepIndex + 1)
      return
    }
    return form.trigger([...DETAIL_FIELDS]).then((valid) => {
      if (valid) goTo(stepIndex + 1)
    })
  }

  return (
    <Dialog
      open
      title={t(`titles.${step}`)}
      fullScreen
      onOpenChange={(isOpen, eventDetails) => {
        // The game search owns the first Escape while its list is open. It reports that
        // and the dialog cancels its own Escape dismissal, so keeping the draft does not
        // depend on event propagation.
        if (!isOpen && eventDetails.reason === 'escape-key' && searchOwnsEscape) {
          eventDetails.cancel()
          return
        }

        if (!isOpen) onClose()
      }}
    >
      <FormProvider {...form}>
        <form
          onSubmit={submit}
          noValidate
          className={cn('flex flex-1 flex-col', step === 'game' && 'max-sm:min-h-0')}
        >
          <Steps
            className="px-6 pt-5"
            label={t('progress')}
            steps={[t('stepLabels.game'), t('stepLabels.details'), t('stepLabels.discord')]}
            current={stepIndex + 1}
          />
          <StepPanel step={step} direction={direction} fill={step === 'game'}>
            {step === 'game' && (
              <GameStep
                selectedGame={selectedGame}
                onSelect={selectGame}
                onEscapeOwnerChange={setSearchOwnsEscape}
              />
            )}
            {step === 'details' && selectedGame && (
              <DetailsStep selectedGame={selectedGame} onChangeGame={() => goTo(0)} />
            )}
            {step === 'discord' && selectedGame && <DiscordStep game={selectedGame} />}
          </StepPanel>
          <CreateSquadFooter
            first={first}
            last={last}
            canContinue={step !== 'game' || selectedGame !== null}
            creating={createSquad.isPending}
            onCancel={onClose}
            onBack={() => goTo(stepIndex - 1)}
          />
        </form>
      </FormProvider>
    </Dialog>
  )
}
