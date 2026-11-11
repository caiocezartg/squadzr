import type { User } from '@domain/entities/user.entity'
import type { IUserRepository } from '@domain/repositories/user.repository'
import { UserNotFoundError } from '@application/errors'

export interface GetUserInput {
  readonly id: string
}

export interface GetUserOutput {
  readonly user: User
}

export interface IGetUserUseCase {
  execute(input: GetUserInput): Promise<GetUserOutput>
}

export class GetUserUseCase implements IGetUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: GetUserInput): Promise<GetUserOutput> {
    const user = await this.userRepository.findById(input.id)
    if (!user) {
      throw new UserNotFoundError(input.id)
    }
    return { user }
  }
}
