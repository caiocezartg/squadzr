import type { IUserNotificationRepository } from '@domain/repositories/user-notification.repository'

export interface DeleteNotificationInput {
  readonly id: string
  readonly userId: string
}

export interface DeleteNotificationOutput {
  readonly success: boolean
}

export interface IDeleteNotificationUseCase {
  execute(input: DeleteNotificationInput): Promise<DeleteNotificationOutput>
}

export class DeleteNotificationUseCase implements IDeleteNotificationUseCase {
  constructor(private readonly userNotificationRepository: IUserNotificationRepository) {}

  async execute(input: DeleteNotificationInput): Promise<DeleteNotificationOutput> {
    const success = await this.userNotificationRepository.delete(input.id, input.userId)
    return { success }
  }
}
