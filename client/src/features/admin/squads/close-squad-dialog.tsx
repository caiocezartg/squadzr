'use client'

import { useId, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ADMIN_CLOSURE_REASON_MAX, ADMIN_CLOSURE_REASON_MIN } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import { Dialog } from '@/components/ds/dialog'
import { ApiClientError } from '@/lib/api-contract'
import { getUserFriendlyError } from '@/lib/error-messages'
import { cn } from '@/lib/utils'
import { useCloseSquad } from './squads-query'

/** The Squad a close is about. */
export interface CloseSquadTarget {
  readonly id: string
  readonly name: string
  readonly memberCount: number
}

interface CloseSquadDialogProps {
  readonly open: boolean
  readonly squad: CloseSquadTarget
  readonly onCancel: () => void
  /** The Squad is closed: the dialog and the panel go. */
  readonly onClosed: (name: string) => void
}

/**
 * Asks before closing an Open Squad: the reason its members read (3 to 280 characters after the trim)
 * with a live count, Cancel or Close Squad. A refused close keeps the dialog open with its reason; a
 * Squad that closed or left Open meanwhile also makes the list read again, so it drops out.
 */
export function CloseSquadDialog({ open, squad, onCancel, onClosed }: CloseSquadDialogProps) {
  const t = useTranslations('admin.squads.closeDialog')
  const tAll = useTranslations()
  const queryClient = useQueryClient()
  const closeSquad = useCloseSquad(squad.id)
  const reasonId = useId()
  const hintId = useId()
  const [reason, setReason] = useState('')
  const length = reason.trim().length
  const valid = length >= ADMIN_CLOSURE_REASON_MIN && length <= ADMIN_CLOSURE_REASON_MAX
  const pending = closeSquad.isPending

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || pending) return
    try {
      await closeSquad.mutateAsync(reason.trim())
      onClosed(squad.name)
    } catch (error) {
      if (isGone(error)) await queryClient.invalidateQueries({ queryKey: ['admin', 'squads'] })
    }
  }

  return (
    <Dialog
      title={t('title', { name: squad.name })}
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel()
      }}
      className="max-w-120"
    >
      {/* The Dialog draws its title first; the eyebrow is moved above it. */}
      <p className="type-label text-danger order-first -mb-4 px-6 pt-6 pr-16">{t('eyebrow')}</p>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col">
        <p className="type-body text-text-3 px-6 pt-3">
          {t.rich('body', {
            count: squad.memberCount,
            members: (chunks) => <b className="text-text">{chunks}</b>,
          })}
        </p>
        <div className="flex flex-col gap-2 px-6 pt-5">
          <label htmlFor={reasonId} className="type-label text-muted">
            {t('reasonLabel')}
          </label>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={ADMIN_CLOSURE_REASON_MAX}
            rows={3}
            required
            disabled={pending}
            aria-describedby={hintId}
            className="text-text placeholder:text-faint min-h-24 w-full resize-y border-0 bg-[#0c0d10] px-4 py-3 text-[15px] font-medium shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-mint)]"
          />
          <p
            id={hintId}
            className="text-muted flex justify-between gap-3 font-mono text-[11px] tabular-nums"
          >
            <span>{t('required')}</span>
            <span className={cn(length > 0 && !valid && 'text-danger')}>
              {length}/{ADMIN_CLOSURE_REASON_MAX}
            </span>
          </p>
        </div>
        <div aria-live="polite" className="px-6">
          {closeSquad.isError && (
            <p role="alert" className="text-danger pt-3 text-[13px] font-semibold">
              {getUserFriendlyError(closeSquad.error, tAll)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-6 pt-6 pb-6">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="danger" disabled={!valid || pending}>
            {pending ? t('confirming') : t('confirm')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** The Squad closed (404) or left Open (422) before this close landed. */
function isGone(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 404 || error.status === 422)
}
