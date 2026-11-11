import type { IUserNotificationRepository } from '@domain/repositories/user-notification.repository'

export interface MarkNotificationReadInput {
  readonly id: string
  readonly userId: string
}

export interface MarkNotificationReadOutput {
  readonly success: boolean
}

export interface IMarkNotificationReadUseCase {
  execute(input: MarkNotificationReadInput): Promise<MarkNotificationReadOutput>
}

export class MarkNotificationReadUseCase implements IMarkNotificationReadUseCase {
  constructor(private readonly userNotificationRepository: IUserNotificationRepository) {}

  async execute(input: MarkNotificationReadInput): Promise<MarkNotificationReadOutput> {
    const success = await this.userNotificationRepository.markAsRead(input.id, input.userId)
    return { success }
  }
}
