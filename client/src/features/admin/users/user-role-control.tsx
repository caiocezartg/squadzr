'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminUserDetailDto, UserRole } from '@squadzr/schemas'
import { Segmented } from '@/components/ds/segmented'
import { getUserFriendlyError } from '@/lib/error-messages'
import { notifyError } from '@/lib/notify'
import { RoleChangeDialog } from './role-change-dialog'
import { useChangeUserRole } from './users-query'

interface UserRoleControlProps {
  readonly user: Pick<AdminUserDetailDto, 'id' | 'name' | 'role'>
  /** The page is the viewer's own: nobody changes their own role. */
  readonly own: boolean
}

/**
 * The person's role as a User/Admin switch. Picking the other role asks first; once confirmed the
 * change is sent, a status line says it is done and the page reads the person again. A refused change
 * shows its reason as an error toast. On the viewer's own page the switch is locked, and says why.
 */
export function UserRoleControl({ user, own }: UserRoleControlProps) {
  const t = useTranslations('admin.users')
  const tAll = useTranslations()
  const ownHintId = useId()
  const changeRole = useChangeUserRole(user.id)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nextRole, setNextRole] = useState<UserRole>(user.role)
  const [changedTo, setChangedTo] = useState<UserRole | null>(null)

  const ask = (role: UserRole) => {
    if (role === user.role) return
    setNextRole(role)
    setChangedTo(null)
    setDialogOpen(true)
  }

  const confirm = () => {
    changeRole.mutate(nextRole, {
      onSuccess: () => setChangedTo(nextRole),
      onError: (error) => notifyError(getUserFriendlyError(error, tAll)),
      onSettled: () => setDialogOpen(false),
    })
  }

  return (
    <section aria-labelledby="admin-user-role" className="flex flex-col gap-2.5">
      <h3 id="admin-user-role" className="type-label text-muted">
        {t('detail.role.label')}
      </h3>
      <Segmented
        label={t('detail.role.label')}
        options={[
          { value: 'user', label: t('roles.user') },
          { value: 'admin', label: t('roles.admin') },
        ]}
        value={user.role}
        onChange={ask}
        disabled={own || changeRole.isPending}
        describedBy={own ? ownHintId : undefined}
        className="self-start"
      />
      {own && (
        <p id={ownHintId} className="text-text-2 text-[12.5px] font-semibold">
          {t('detail.role.own')}
        </p>
      )}
      <p className="text-muted text-[12.5px] leading-normal font-medium">{t('detail.role.hint')}</p>
      <p role="status" className="text-mint text-[12.5px] font-semibold empty:hidden">
        {changedTo && t('detail.role.changed', { name: user.name, role: changedTo })}
      </p>
      <RoleChangeDialog
        open={dialogOpen}
        name={user.name}
        role={nextRole}
        pending={changeRole.isPending}
        onConfirm={confirm}
        onCancel={() => setDialogOpen(false)}
      />
    </section>
  )
}
