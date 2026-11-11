import type { IUserNotificationRepository } from '@domain/repositories/user-notification.repository'

export interface MarkAllNotificationsReadInput {
  readonly userId: string
}

export interface MarkAllNotificationsReadOutput {
  readonly count: number
}

export interface IMarkAllNotificationsReadUseCase {
  execute(input: MarkAllNotificationsReadInput): Promise<MarkAllNotificationsReadOutput>
}

export class MarkAllNotificationsReadUseCase implements IMarkAllNotificationsReadUseCase {
  constructor(private readonly userNotificationRepository: IUserNotificationRepository) {}

  async execute(input: MarkAllNotificationsReadInput): Promise<MarkAllNotificationsReadOutput> {
    const count = await this.userNotificationRepository.markAllAsRead(input.userId)
    return { count }
  }
}
