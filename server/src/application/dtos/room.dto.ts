// Room HTTP contracts live in @squadzr/schemas (ADR-0001); re-exported under the server names
export {
  createRoomInputSchema as createRoomRequestSchema,
  roomCodeParamSchema,
} from '@squadzr/schemas'
export type { CreateRoomInput as CreateRoomRequestDto, RoomCodeParamDto } from '@squadzr/schemas'
