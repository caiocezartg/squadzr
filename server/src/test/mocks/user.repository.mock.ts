import { vi, type Mock } from 'vitest'
import type { NewAuditEntry } from '@domain/entities/audit-entry.entity'
import type { User } from '@domain/entities/user.entity'
import type { IUserRepository } from '@domain/repositories/user.repository'

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-uuid-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    role: 'user',
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
    findByIdOrDiscordId: vi
      .fn<(identifier: string) => Promise<User | null>>()
      .mockResolvedValue(null),
    findOwner: vi.fn<() => Promise<User | null>>().mockResolvedValue(null),
    grantRole: vi
      .fn<(userId: string, role: 'admin' | 'owner', audit: NewAuditEntry) => Promise<boolean>>()
      .mockResolvedValue(true),
  }
}
