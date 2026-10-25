import { sql } from 'drizzle-orm'
import { MEMBER_PREVIEW_LIMIT } from '@squadzr/schemas'
import type { MemberPreview } from '@domain/entities/room.entity'
import { rooms } from '@infrastructure/database/schema/rooms'

/**
 * A Squad's member preview, as a column of the Squad's own query: up to five
 * members, host first, then by join time, then by user id (`"C"` collation, so
 * the order matches the roster sort in the application layer). The correlated
 * subquery runs inside the database, so a list of Squads still costs one query.
 */
export const memberPreviewColumn = sql<MemberPreview[]>`coalesce((
  select json_agg(
    json_build_object('id', preview.id, 'name', preview.name, 'image', preview.image)
    order by preview.is_host desc, preview.joined_at, preview.id collate "C"
  )
  from (
    select
      preview_user.id,
      preview_user.name,
      preview_user.image,
      preview_member.joined_at,
      preview_member.user_id = ${rooms.hostId} as is_host
    from room_members preview_member
    inner join "user" preview_user on preview_user.id = preview_member.user_id
    where preview_member.room_id = ${rooms.id}
    order by is_host desc, preview_member.joined_at, preview_user.id collate "C"
    limit ${MEMBER_PREVIEW_LIMIT}
  ) preview
), '[]'::json)`
