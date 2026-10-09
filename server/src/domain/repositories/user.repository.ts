import type { User } from '@domain/entities/user.entity'

export interface IUserRepository {
  findById(id: string): Promise<User | null>
  findByIds(ids: string[]): Promise<User[]>
}
