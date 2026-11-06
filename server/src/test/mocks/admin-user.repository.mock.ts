import { vi, type Mock } from 'vitest'
import type { AdminUser } from '@domain/entities/admin-user.entity'
import type {
  AdminUserPage,
  ChangeRoleCommand,
  IAdminUserRepository,
  RoleChangeOutcome,
} from '@domain/repositories/admin-user.repository'

export function createMockAdminUser(overrides?: Partial<AdminUser>): AdminUser {
  return {
    id: 'user-uuid-1',
    name: 'Test User',
    avatarUrl: null,
    discordId: null,
    role: 'user',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export type MockAdminUserRepository = {
  [K in keyof IAdminUserRepository]: Mock<IAdminUserRepository[K]>
}

export function createMockAdminUserRepository(): MockAdminUserRepository {
  return {
    list: vi
      .fn<
        (
          search: string | undefined,
          offset: number,
          limit: number,
          now: Date
        ) => Promise<AdminUserPage>
      >()
      .mockResolvedValue({ items: [], total: 0 }),
    findById: vi.fn<(id: string) => Promise<AdminUser | null>>().mockResolvedValue(null),
    findOpenSquads: vi.fn<IAdminUserRepository['findOpenSquads']>().mockResolvedValue([]),
    findLatestCompleted: vi.fn<IAdminUserRepository['findLatestCompleted']>().mockResolvedValue([]),
    changeRole: vi
      .fn<(command: ChangeRoleCommand) => Promise<RoleChangeOutcome>>()
      .mockResolvedValue({ status: 'changed' }),
  }
}
