import { and, desc, eq, gt, sql, type SQL } from 'drizzle-orm'
import type { ChatMessage, ChatMessageView } from '@domain/entities/chat-message.entity'
import type {
  ChatRateRule,
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
type StoredOutcome = Extract<CreateChatMessageOutcome, { kind: 'duplicate' | 'id_conflict' }>

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

/** A stored message under the input's id is a retry when it is the same author's in the same Squad. */
async function findStored(db: ChatDatabase, input: ChatMessage): Promise<StoredOutcome | null> {
  const [row] = await selectViews(db).where(eq(chatMessages.id, input.id)).limit(1)
  if (!row) return null
  const isRetry = row.roomId === input.roomId && row.authorId === input.authorId
  return isRetry ? { kind: 'duplicate', message: mapRowToView(row) } : { kind: 'id_conflict' }
}

/**
 * The author's message whose leaving the window frees a slot, or null while they are under
 * the limit. A message counts only after `windowStart`, so one exactly a window old is out.
 */
async function findLimitingMessage(
  db: ChatDatabase,
  input: ChatMessage,
  rule: ChatRateRule
): Promise<Date | null> {
  const [limiting] = await db
    .select({ createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.roomId, input.roomId),
        eq(chatMessages.authorId, input.authorId),
        gt(chatMessages.createdAt, rule.windowStart)
      )
    )
    .orderBy(desc(chatMessages.createdAt))
    .offset(rule.limit - 1)
    .limit(1)
  return limiting?.createdAt ?? null
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

  async createWithinRate(
    input: ChatMessage,
    rule: ChatRateRule
  ): Promise<CreateChatMessageOutcome> {
    return this.db.transaction(async (tx) => {
      // The room row lock serializes this send against leaves, sends and the join that makes
      // the Squad Ready, so the Membership, Ready and rate reads below stay true until the
      // message is stored.
      const room = await lockRoomRow(tx, input.roomId)
      if (!room) return { kind: 'not_member' }

      const membership = await tx
        .select({ id: roomMembers.id })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, input.roomId), eq(roomMembers.userId, input.authorId)))
        .limit(1)
      if (membership.length === 0) return { kind: 'not_member' }

      // A retry is answered with the stored message before the Ready and rate checks:
      // it adds nothing, so neither can refuse it.
      const stored = await findStored(tx, input)
      if (stored) return stored

      if (room.readyAt) return { kind: 'ready' }

      const oldestInWindow = await findLimitingMessage(tx, input, rule)
      if (oldestInWindow) return { kind: 'rate_limited', oldestInWindow }

      const inserted = await tx
        .insert(chatMessages)
        .values(input)
        .onConflictDoNothing({ target: chatMessages.id })
        .returning({ id: chatMessages.id })

      // Losing the insert means another Squad stored the id between the lookup and here.
      if (inserted.length === 0) return (await findStored(tx, input)) ?? { kind: 'id_conflict' }

      const [row] = await selectViews(tx).where(eq(chatMessages.id, input.id)).limit(1)
      return row ? { kind: 'created', message: mapRowToView(row) } : { kind: 'id_conflict' }
    })
  }
}
