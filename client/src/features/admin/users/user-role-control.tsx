'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ASSIGNABLE_ROLES,
  type AdminUserDetailDto,
  type AssignableRole,
  type UserRole,
} from '@squadzr/schemas'
import { Segmented } from '@/components/ds/segmented'
import { getUserFriendlyError } from '@/lib/error-messages'
import { notifyError } from '@/lib/notify'
import { RoleChangeDialog } from './role-change-dialog'
import { RolePill } from './user-parts'
import { useChangeUserRole } from './users-query'

/** Why the switch is locked: the viewer's own page, the owner's page, or an admin's page to an admin. */
export type RoleLock = 'own' | 'owner' | 'adminTarget'

/**
 * Why the viewer cannot change `target`'s role, or `null` when they can. `grantable` is what
 * `grantableRoles` allows the viewer to give the target.
 */
export function roleLock(
  own: boolean,
  target: UserRole,
  grantable: readonly AssignableRole[]
): RoleLock | null {
  if (own) return 'own'
  if (target === 'owner') return 'owner'
  if (grantable.length === 0) return 'adminTarget'
  return null
}

interface UserRoleControlProps {
  readonly user: Pick<AdminUserDetailDto, 'id' | 'name' | 'role'>
  /** The page is the viewer's own: nobody changes their own role. */
  readonly own: boolean
  /** The roles the viewer may give the person (`grantableRoles`), before the own-page rule. */
  readonly grantable: readonly AssignableRole[]
}

/**
 * The person's role as a User/Moderator/Admin switch, holding only the roles the viewer may give.
 * Picking another role asks first; once confirmed the change is sent, a status line says it is done
 * and the page reads the person again. A refused change shows its reason as an error toast. On the
 * viewer's own page, the owner's page, or an admin's page seen by an admin, the switch is locked and
 * says why.
 */
export function UserRoleControl({ user, own, grantable }: UserRoleControlProps) {
  const t = useTranslations('admin.users')
  const tAll = useTranslations()
  const lockHintId = useId()
  const changeRole = useChangeUserRole(user.id)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nextRole, setNextRole] = useState<AssignableRole>('user')
  const [changedTo, setChangedTo] = useState<AssignableRole | null>(null)
  const lock = roleLock(own, user.role, grantable)
  const shown: readonly UserRole[] = [
    ...(grantable.length > 0 ? grantable : ASSIGNABLE_ROLES),
    ...(user.role === 'owner' ? (['owner'] as const) : []),
  ]

  const ask = (role: UserRole) => {
    if (role === user.role || role === 'owner') return
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
        options={shown.map((role) => ({ value: role, label: t(`roles.${role}`) }))}
        value={user.role}
        onChange={ask}
        disabled={lock !== null || changeRole.isPending}
        describedBy={lock ? lockHintId : undefined}
        className="self-start"
      />
      {lock && (
        <p id={lockHintId} className="text-text-2 text-[12.5px] font-semibold">
          {t(`detail.role.${lock}`)}
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

/** The person's role for a viewer who changes no roles (a moderator): its pill, read only. */
export function UserRoleView({ role }: { readonly role: UserRole }) {
  const t = useTranslations('admin.users')

  return (
    <section aria-labelledby="admin-user-role" className="flex flex-col gap-2.5">
      <h3 id="admin-user-role" className="type-label text-muted">
        {t('detail.role.label')}
      </h3>
      <span className="self-start">
        <RolePill role={role} />
      </span>
    </section>
  )
}
