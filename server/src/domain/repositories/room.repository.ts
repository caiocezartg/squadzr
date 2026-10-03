import type { CreateRoomInput, Room, UpdateRoomInput } from '@domain/entities/room.entity'

export interface IRoomRepository {
  findById(id: string): Promise<Room | null>
  findByCode(code: string): Promise<Room | null>
  findByHostId(hostId: string): Promise<Room[]>
  findAll(): Promise<Room[]>
  findAvailable(): Promise<Room[]>
  countActiveByHostId(hostId: string): Promise<number>
  findMyRooms(userId: string): Promise<{ hosted: Room[]; joined: Room[] }>
  create(input: CreateRoomInput): Promise<Room>
  findExpiredRooms(beforeDate: Date): Promise<Room[]>
  update(id: string, input: UpdateRoomInput): Promise<Room | null>
  delete(id: string): Promise<boolean>
}
