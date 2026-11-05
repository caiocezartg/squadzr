'use client'

import { useTranslations } from 'next-intl'
import type { UserRole } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import { Dialog } from '@/components/ds/dialog'

interface RoleChangeDialogProps {
  readonly open: boolean
  readonly name: string
  /** The role the change would give the person. */
  readonly role: UserRole
  readonly pending: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/** Asks before a role change: who it is about, the new role and what it means, Confirm or Cancel. */
export function RoleChangeDialog({
  open,
  name,
  role,
  pending,
  onConfirm,
  onCancel,
}: RoleChangeDialogProps) {
  const t = useTranslations('admin.users.detail.dialog')

  return (
    <Dialog
      title={t('title', { name, role })}
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel()
      }}
      className="max-w-120"
    >
      <p className="type-body text-text-3 px-6 pt-3">{t('body', { name, role })}</p>
      <div className="flex flex-wrap justify-end gap-2 px-6 pt-6 pb-6">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button onClick={onConfirm} disabled={pending}>
          {pending ? t('confirming') : t('confirm')}
        </Button>
      </div>
    </Dialog>
  )
}
