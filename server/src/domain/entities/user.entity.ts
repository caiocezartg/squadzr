import type { UserRole } from '@squadzr/schemas'

export interface User {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly avatarUrl: string | null
  readonly role: UserRole
  readonly createdAt: Date
  readonly updatedAt: Date
}
