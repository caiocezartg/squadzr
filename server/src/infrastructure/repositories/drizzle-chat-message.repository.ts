import { and, eq, sql, type SQL } from 'drizzle-orm'
import type { ChatMessage, ChatMessageView } from '@domain/entities/chat-message.entity'
import type {
  CreateChatMessageOutcome,
  IChatMessageRepository,
  ListChatMessagesOptions,
} from '@domain/repositories/chat-message.repository'
import type { Database } from '@infrastructure/database/drizzle'
import { chatMessages } from '@infrastructure/database/schema/chat-messages'
import { roomMembers } from '@infrastructure/database/schema/room-members'
import { user } from '@infrastructure/database/schema/auth'
import { lockRoomRow } from './room-join-steps'

type ChatDatabase = Pick<Database, 'select'>

const viewColumns = {
  id: chatMessages.id,
  roomId: chatMessages.roomId,
  authorId: chatMessages.authorId,
  body: chatMessages.body,
  createdAt: chatMessages.createdAt,
  authorName: user.name,
  authorImage: user.image,
}

interface ChatMessageViewRow {
  readonly id: string
  readonly roomId: string
  readonly authorId: string
  readonly body: string
  readonly createdAt: Date
  readonly authorName: string
  readonly authorImage: string | null
}

function mapRowToView(row: ChatMessageViewRow): ChatMessageView {
  return {
    id: row.id,
    roomId: row.roomId,
    authorId: row.authorId,
    body: row.body,
    createdAt: row.createdAt,
    author: { id: row.authorId, name: row.authorName, avatarUrl: row.authorImage },
  }
}

function selectViews(db: ChatDatabase) {
  return db
    .select(viewColumns)
    .from(chatMessages)
    .innerJoin(user, eq(user.id, chatMessages.authorId))
}

/**
 * Keyset cursor, resolved in SQL and scoped to the Squad: the cursor row is read by id inside
 * the same room, so a foreign or unknown id compares against nothing and matches no row.
 */
function olderThan(roomId: string, beforeId: string | undefined): SQL | undefined {
  if (!beforeId) return undefined
  return sql`(${chatMessages.createdAt}, ${chatMessages.id}) < (
    select pivot.created_at, pivot.id from ${chatMessages} as pivot
    where pivot.id = ${beforeId} and pivot.room_id = ${roomId}
  )`
}

export class DrizzleChatMessageRepository implements IChatMessageRepository {
  constructor(private readonly db: Database) {}

  async listByRoom(roomId: string, options: ListChatMessagesOptions): Promise<ChatMessageView[]> {
    // `nulls last` spells the order of the history index, which Drizzle declares that way.
    const rows = await selectViews(this.db)
      .where(and(eq(chatMessages.roomId, roomId), olderThan(roomId, options.beforeId)))
      .orderBy(
        sql`${chatMessages.createdAt} desc nulls last`,
        sql`${chatMessages.id} desc nulls last`
      )
      .limit(options.limit)

    return rows.map(mapRowToView)
  }

  async createWithinRate(input: ChatMessage): Promise<CreateChatMessageOutcome> {
    return this.db.transaction(async (tx) => {
      // The room row lock serializes this send against leaves and joins on the same Squad,
      // so the Membership read below stays true until the message is stored.
      const room = await lockRoomRow(tx, input.roomId)
      if (!room) return { kind: 'not_member' }

      const membership = await tx
        .select({ id: roomMembers.id })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, input.roomId), eq(roomMembers.userId, input.authorId)))
        .limit(1)
      if (membership.length === 0) return { kind: 'not_member' }

      const inserted = await tx
        .insert(chatMessages)
        .values(input)
        .onConflictDoNothing({ target: chatMessages.id })
        .returning({ id: chatMessages.id })

      const [row] = await selectViews(tx).where(eq(chatMessages.id, input.id)).limit(1)
      if (!row) return { kind: 'id_conflict' }

      if (inserted.length > 0) return { kind: 'created', message: mapRowToView(row) }

      const isRetry = row.roomId === input.roomId && row.authorId === input.authorId
      return isRetry ? { kind: 'duplicate', message: mapRowToView(row) } : { kind: 'id_conflict' }
    })
  }
}
