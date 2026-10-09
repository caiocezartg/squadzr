export interface User {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly avatarUrl: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}
