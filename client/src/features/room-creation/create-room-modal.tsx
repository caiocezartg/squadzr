import { useForm, Controller } from 'react-hook-form'
import { useState, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Dialog } from '@base-ui-components/react/dialog'
import { Select } from '@base-ui-components/react/select'
import * as motion from 'motion/react-client'
import { X, Loader2, ChevronsUpDown, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { createRoomInputSchema, createRoomResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
// The commands module is the catalog's cross-capability port. Importing it
// directly keeps the catalog barrel (which renders this dialog through the
// catalog page) out of a cycle.
import { useCatalogCommands } from '@/features/catalog/use-catalog-commands'
import type { Game, Room } from '@/types'
import type { CreateRoomInput } from '@squadzr/schemas'

const formSchema = createRoomInputSchema.extend({
  gameId: z.uuid({ error: 'Please select a game' }),
})

type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

export interface CreateRoomModalProps {
  games: Game[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Called with the new room after the catalog refresh was requested and
   * before navigating to its lobby, so the caller can refresh its own data.
   */
  onCreated?: (room: Room) => void
}

interface TagsChipInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  onBlur: () => void
  hasError: boolean
}

function TagsChipInput({ value: tags, onChange, onBlur, hasError }: TagsChipInputProps) {
  const { t } = useTranslation()
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
      className={`input-field flex min-h-[44px] cursor-text flex-wrap items-center gap-2 ${
        hasError ? 'border-danger/50 focus-within:border-danger/70 focus-within:ring-danger/20' : ''
      }`}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1 rounded-md border border-border-light bg-surface-light px-2 py-0.5 text-xs text-offwhite"
        >
          #{tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(index)
            }}
            className="ml-0.5 flex items-center justify-center text-muted transition-colors hover:text-offwhite"
            aria-label={t('rooms.createModal.removeTag', { tag })}
          >
            <X className="size-[10px]" strokeWidth={3} />
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
          className="min-w-[96px] flex-1 bg-transparent text-sm text-offwhite outline-none placeholder:text-muted/60"
          placeholder={
            tags.length === 0
              ? t('rooms.createModal.tagsPlaceholder')
              : t('rooms.createModal.tagsPlaceholderMore')
          }
          aria-label="Add tag"
        />
      )}
    </div>
  )
}

const languageOptions = [
  { value: 'pt-br', label: 'PT-BR' },
  { value: 'en', label: 'EN-US' },
] as const

/**
 * The create-room dialog: form values are inferred from the shared contract,
 * and the creation mutation, its typed errors, the catalog refresh and the
 * navigation to the new lobby stay internal. Callers supply the games they
 * already loaded and control the dialog.
 */
export function CreateRoomModal({ games, open, onOpenChange, onCreated }: CreateRoomModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refreshRooms } = useCatalogCommands()
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
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

  const selectedGameId = watch('gameId')
  const selectedGame = games.find((game) => game.id === selectedGameId)

  const maxPlayersHelperText = selectedGame
    ? t('rooms.createModal.playerLimitHelperWithGame', {
        maxPlayers: selectedGame.maxPlayers,
        gameName: selectedGame.name,
      })
    : t('rooms.createModal.playerLimitHelper')

  const createRoom = useMutation({
    mutationFn: (input: CreateRoomInput) => api.post('/api/rooms', input, createRoomResponseSchema),
    onSuccess: (result) => {
      onOpenChange(false)
      // The creating tab may miss its own `room_created` (the event can arrive
      // after this page unmounts), so the new room is requested explicitly,
      // like the join flow does. The navigate follows immediately; the
      // in-flight refresh survives the unmount.
      void refreshRooms()
      onCreated?.(result.room)
      navigate({ to: '/rooms/$code', params: { code: result.room.code } })
    },
  })

  const onFormSubmit = handleSubmit(async (data) => {
    try {
      await createRoom.mutateAsync(data)
    } catch (err) {
      toast.error(getUserFriendlyError(err))
    }
  })

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) reset()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-5">
          <motion.div
            className="my-4 w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50 sm:my-8"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <Dialog.Title className="font-heading text-lg font-bold">
                {t('rooms.createModal.title')}
              </Dialog.Title>
              <Dialog.Close className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-offwhite">
                <X className="size-5" />
              </Dialog.Close>
            </div>

            <form onSubmit={onFormSubmit} className="flex flex-col gap-6 p-5 sm:p-6 lg:p-7">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-1.5 lg:col-span-2">
                  <label
                    htmlFor="modal-roomName"
                    className="block whitespace-nowrap text-sm font-medium text-offwhite"
                  >
                    {t('rooms.createModal.roomName')}
                  </label>
                  <input
                    id="modal-roomName"
                    type="text"
                    className={errors.name ? 'input-field-error' : 'input-field'}
                    placeholder={t('rooms.createModal.roomNamePlaceholder')}
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="field-error">
                      {errors.name.type === 'too_small'
                        ? t('rooms.createModal.nameRequired')
                        : t('rooms.createModal.nameTooLong')}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px] gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="modal-gameId"
                        className="block whitespace-nowrap text-sm font-medium text-offwhite"
                      >
                        {t('rooms.createModal.game')}
                      </label>
                      <Controller
                        name="gameId"
                        control={control}
                        render={({ field }) => {
                          const selectedOption = games.find((game) => game.id === field.value)
                          const selectedLabel = selectedOption
                            ? t('rooms.createModal.gameWithPlayers', {
                                name: selectedOption.name,
                                min: selectedOption.minPlayers,
                                max: selectedOption.maxPlayers,
                              })
                            : null

                          return (
                            <Select.Root
                              value={field.value || null}
                              onValueChange={(value) => {
                                field.onChange(value)
                              }}
                            >
                              <Select.Trigger
                                id="modal-gameId"
                                className={`flex h-[44px] w-full cursor-default select-none items-center justify-between rounded-lg border px-4 text-sm transition-colors duration-200 focus:outline-none focus:ring-1 ${
                                  errors.gameId
                                    ? 'border-danger/50 bg-surface text-offwhite focus:border-danger/70 focus:ring-danger/20'
                                    : 'border-border-light bg-surface text-offwhite hover:border-muted/30 focus:border-accent/50 focus:ring-accent/20'
                                } data-[popup-open]:border-accent/50 data-[popup-open]:ring-1 data-[popup-open]:ring-accent/20`}
                              >
                                <span className={`truncate ${field.value ? '' : 'text-muted/60'}`}>
                                  {selectedLabel ?? t('rooms.createModal.selectGame')}
                                </span>
                                <Select.Icon className="flex items-center text-muted">
                                  <ChevronsUpDown className="size-3" />
                                </Select.Icon>
                              </Select.Trigger>
                              <Select.Portal>
                                <Select.Positioner
                                  className="z-[60] select-none outline-none"
                                  sideOffset={8}
                                >
                                  <Select.Popup className="origin-[var(--transform-origin)] rounded-xl border border-border bg-surface shadow-2xl shadow-black/50 transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                                    <Select.ScrollUpArrow className="flex h-5 w-full cursor-default items-center justify-center bg-surface text-muted" />
                                    <Select.List className="relative max-h-[var(--available-height)] overflow-y-auto py-1">
                                      {games.map((game) => (
                                        <Select.Item
                                          key={game.id}
                                          value={game.id}
                                          className="grid min-w-[var(--anchor-width)] cursor-default select-none grid-cols-[1rem_1fr] items-center gap-2 px-3 py-2.5 text-sm text-offwhite outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-accent"
                                        >
                                          <Select.ItemIndicator className="col-start-1">
                                            <Check className="size-3.5" />
                                          </Select.ItemIndicator>
                                          <Select.ItemText className="col-start-2">
                                            {t('rooms.createModal.gameWithPlayers', {
                                              name: game.name,
                                              min: game.minPlayers,
                                              max: game.maxPlayers,
                                            })}
                                          </Select.ItemText>
                                        </Select.Item>
                                      ))}
                                    </Select.List>
                                    <Select.ScrollDownArrow className="flex h-5 w-full cursor-default items-center justify-center bg-surface text-muted" />
                                  </Select.Popup>
                                </Select.Positioner>
                              </Select.Portal>
                            </Select.Root>
                          )
                        }}
                      />
                      {errors.gameId && (
                        <p className="field-error">{t('rooms.createModal.selectGameError')}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="modal-maxPlayers"
                        className="block whitespace-nowrap text-sm font-medium text-offwhite"
                      >
                        {t('rooms.createModal.playerLimit')}{' '}
                        <span className="font-normal text-muted">
                          {t('rooms.createModal.optional')}
                        </span>
                      </label>
                      <input
                        id="modal-maxPlayers"
                        type="number"
                        className={errors.maxPlayers ? 'input-field-error' : 'input-field'}
                        min={2}
                        placeholder={selectedGame?.maxPlayers?.toString() ?? ''}
                        {...register('maxPlayers', {
                          setValueAs: (value: string) =>
                            value === '' || isNaN(Number(value)) ? undefined : Number(value),
                        })}
                      />
                      {errors.maxPlayers && (
                        <p className="field-error">
                          {errors.maxPlayers.type === 'too_small'
                            ? t('rooms.createModal.maxPlayersTooFew')
                            : t('rooms.createModal.maxPlayersTooMany')}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted">{maxPlayersHelperText}</p>
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <label
                    htmlFor="modal-discordLink"
                    className="block whitespace-nowrap text-sm font-medium text-offwhite"
                  >
                    {t('rooms.createModal.discordLink')}
                  </label>
                  <input
                    id="modal-discordLink"
                    type="url"
                    className={errors.discordLink ? 'input-field-error' : 'input-field'}
                    placeholder="https://discord.gg/..."
                    {...register('discordLink')}
                  />
                  <p className="text-xs text-muted">{t('rooms.createModal.discordLinkHelper')}</p>
                  {errors.discordLink && (
                    <p className="field-error">
                      {errors.discordLink.type === 'custom'
                        ? t('rooms.createModal.discordLinkNotValid')
                        : t('rooms.createModal.discordLinkInvalid')}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <label className="block whitespace-nowrap text-sm font-medium text-offwhite">
                    {t('rooms.createModal.tags')}{' '}
                    <span className="font-normal text-muted">
                      {t('rooms.createModal.optional')}
                    </span>
                  </label>
                  <Controller
                    name="tags"
                    control={control}
                    render={({ field }) => (
                      <TagsChipInput
                        value={field.value ?? []}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        hasError={!!errors.tags}
                      />
                    )}
                  />
                  <p className="text-xs text-muted">{t('rooms.createModal.tagsHelper')}</p>
                  {errors.tags && <p className="field-error">{errors.tags.message}</p>}
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <label className="block whitespace-nowrap text-sm font-medium text-offwhite">
                    {t('rooms.createModal.language')}
                  </label>
                  <Controller
                    name="language"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2">
                        {languageOptions.map(({ value, label }) => (
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
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                  {errors.language && <p className="field-error">{errors.language.message}</p>}
                </div>
              </div>

              <button
                type="submit"
                disabled={createRoom.isPending}
                className="btn-accent mt-1 w-full py-3"
              >
                {createRoom.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {t('rooms.createModal.creating')}
                  </span>
                ) : (
                  t('rooms.createModal.submit')
                )}
              </button>
            </form>
          </motion.div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
