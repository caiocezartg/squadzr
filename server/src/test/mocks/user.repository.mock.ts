import { vi, type Mock } from 'vitest'
import type { User } from '@domain/entities/user.entity'
import type { IUserRepository } from '@domain/repositories/user.repository'

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-uuid-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export type MockUserRepository = {
  [K in keyof IUserRepository]: Mock<IUserRepository[K]>
}

export function createMockUserRepository(): MockUserRepository {
  return {
    findById: vi.fn<(id: string) => Promise<User | null>>().mockResolvedValue(null),
    findByIds: vi.fn<(ids: string[]) => Promise<User[]>>().mockResolvedValue([]),
  }
}
