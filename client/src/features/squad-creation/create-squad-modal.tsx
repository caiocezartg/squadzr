'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog } from '@base-ui-components/react/dialog'
import * as m from 'motion/react-m'
import { X, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createRoomInputSchema, createRoomResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
import { languageBadgeKey } from '@/lib/language-badge'
import { notifyError } from '@/lib/notify'
import { useAppNavigation } from '@/lib/navigation'
import { lobbyHref } from '@/lib/squad-links'
// The board's barrel exports only its cache commands, so this import cannot close a cycle back to the page that renders this dialog.
import { useMySquadsCommands } from '@/features/my-squads'
import { useSquadBoardCommands } from '@/features/squad-board'
import type { Game, Squad } from '@/types'
import type { CreateRoomInput } from '@squadzr/schemas'
import { FormField } from './form-field'
import { GameSelect } from './game-select'
import { TagsInput } from './tags-input'
import { translateTagError } from './tag-errors'

const formSchema = createRoomInputSchema.extend({
  gameId: z.uuid(),
})

type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

export interface CreateSquadModalProps {
  /** Dismisses the dialog; the caller unmounts it, so the next open starts from an empty form. */
  onClose: () => void
  /**
   * Called with the new squad after the board refresh was requested and
   * before navigating to its lobby, so the caller can refresh its own data.
   */
  onCreated?: (squad: Squad) => void
}

const languageOptions = ['pt-br', 'en'] as const

/**
 * The create-Squad dialog: form values are inferred from the shared contract, and the creation
 * mutation, its typed errors, the board refresh and the navigation to the new lobby stay internal.
 * The game picker searches the catalog, so callers no longer load the games list for it. Callers mount
 * the dialog while it is open.
 */
export function CreateSquadModal({ onClose, onCreated }: CreateSquadModalProps) {
  const t = useTranslations()
  // The lobby is still served by the old app, so the navigation goes through the shell's helper.
  const navigateApp = useAppNavigation()
  const { refreshSquads } = useSquadBoardCommands()
  const { refreshMySquads } = useMySquadsCommands()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
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

  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [gameListOpen, setGameListOpen] = useState(false)

  const maxPlayersHelperText = selectedGame
    ? t('squads.createModal.playerLimitHelperWithGame', {
        maxPlayers: selectedGame.maxPlayers,
        gameName: selectedGame.name,
      })
    : t('squads.createModal.playerLimitHelper')

  const createSquad = useMutation({
    mutationFn: (input: CreateRoomInput) => api.post('/api/rooms', input, createRoomResponseSchema),
    onSuccess: (result) => {
      // The caller unmounts the dialog; a fresh mount starts from an empty form.
      onClose()
      // The creating tab may miss its own `room_created` (the event can arrive
      // after this page unmounts), so the new squad is requested explicitly,
      // like the join flow does. The navigate follows immediately; the
      // in-flight refresh survives the unmount.
      void refreshSquads()
      void refreshMySquads()
      onCreated?.(result.room)
      navigateApp(lobbyHref(result.room.code))
    },
  })

  const onFormSubmit = handleSubmit(async (data) => {
    try {
      await createSquad.mutateAsync(data)
    } catch (err) {
      notifyError(getUserFriendlyError(err, t))
    }
  })

  return (
    <Dialog.Root
      open
      onOpenChange={(isOpen, eventDetails) => {
        // The game picker owns the first Escape while its list is open. The
        // picker reports its list and the dialog cancels its own Escape
        // dismissal, so keeping the draft does not depend on event propagation.
        if (!isOpen && eventDetails.reason === 'escape-key' && gameListOpen) {
          eventDetails.cancel()
          return
        }

        if (!isOpen) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
        <Dialog.Popup className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-5">
          <m.div
            className="my-4 w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50 sm:my-8"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <Dialog.Title className="font-heading text-lg font-bold">
                {t('squads.createModal.title')}
              </Dialog.Title>
              <Dialog.Close className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-offwhite">
                <X className="size-5" />
              </Dialog.Close>
            </div>

            <form onSubmit={onFormSubmit} className="flex flex-col gap-6 p-5 sm:p-6 lg:p-7">
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
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_160px]">
                    <FormField
                      htmlFor="modal-gameId"
                      label={t('squads.createModal.game')}
                      error={errors.gameId ? t('squads.createModal.selectGameError') : undefined}
                    >
                      {/* The Select adds a hidden input after its trigger; wrapped, it is not the last child of the space-y stack. */}
                      <div>
                        <Controller
                          name="gameId"
                          control={control}
                          render={({ field }) => (
                            <GameSelect
                              id="modal-gameId"
                              selectedGame={selectedGame}
                              onSelect={(game) => {
                                setSelectedGame(game)
                                field.onChange(game?.id ?? '')
                              }}
                              onListOpenChange={setGameListOpen}
                              hasError={!!errors.gameId}
                            />
                          )}
                        />
                      </div>
                    </FormField>

                    <FormField
                      htmlFor="modal-maxPlayers"
                      label={
                        <>
                          {t('squads.createModal.playerLimit')}{' '}
                          <span className="font-normal text-muted">
                            {t('squads.createModal.optional')}
                          </span>
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
                  </div>
                  <p className="text-xs text-muted">{maxPlayersHelperText}</p>
                </div>

                <FormField
                  htmlFor="modal-discordLink"
                  label={t('squads.createModal.discordLink')}
                  hint={t('squads.createModal.discordLinkHelper')}
                  error={
                    errors.discordLink
                      ? errors.discordLink.type === 'custom'
                        ? t('squads.createModal.discordLinkNotValid')
                        : t('squads.createModal.discordLinkInvalid')
                      : undefined
                  }
                  className="lg:col-span-2"
                >
                  <input
                    id="modal-discordLink"
                    type="url"
                    className={errors.discordLink ? 'input-field-error' : 'input-field'}
                    placeholder="https://discord.gg/..."
                    {...register('discordLink')}
                  />
                </FormField>

                <FormField
                  label={
                    <>
                      {t('squads.createModal.tags')}{' '}
                      <span className="font-normal text-muted">
                        {t('squads.createModal.optional')}
                      </span>
                    </>
                  }
                  hint={t('squads.createModal.tagsHelper')}
                  error={
                    errors.tags?.message ? translateTagError(errors.tags.message, t) : undefined
                  }
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

              <button
                type="submit"
                disabled={createSquad.isPending}
                className="btn-accent mt-1 w-full py-3"
              >
                {createSquad.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {t('squads.createModal.creating')}
                  </span>
                ) : (
                  t('squads.createModal.submit')
                )}
              </button>
            </form>
          </m.div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
