import { PAGE_SIZE } from '@squadzr/schemas'
import type { AdminUserListItem } from '@domain/entities/admin-user.entity'
import type { IAdminUserRepository } from '@domain/repositories/admin-user.repository'
import type { Clock } from '@domain/services/clock.interface'

export interface ListAdminUsersInput {
  /** A name (any part of it), or a Discord id or a user id exactly; absent or empty lists everyone. */
  readonly search?: string
  /** 1-based; a page past the end gives no users and the real total. */
  readonly page: number
}

export interface ListAdminUsersOutput {
  readonly users: AdminUserListItem[]
  readonly page: number
  readonly pageSize: typeof PAGE_SIZE
  readonly total: number
}

export interface IListAdminUsersUseCase {
  execute(input: ListAdminUsersInput): Promise<ListAdminUsersOutput>
}

/** The admin panel's user list: newest first, 20 per page, searchable. */
export class ListAdminUsersUseCase implements IListAdminUsersUseCase {
  constructor(
    private readonly adminUserRepository: IAdminUserRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: ListAdminUsersInput): Promise<ListAdminUsersOutput> {
    const { items, total } = await this.adminUserRepository.list(
      input.search?.trim() || undefined,
      (input.page - 1) * PAGE_SIZE,
      PAGE_SIZE,
      this.clock.now()
    )

    return { users: items, page: input.page, pageSize: PAGE_SIZE, total }
  }
}
