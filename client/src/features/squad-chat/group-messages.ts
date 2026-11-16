import type { SquadChatMessage } from './squad-chat-message'

/** Messages of one author this close to each other share a header. */
export const GROUP_WINDOW_MS = 2 * 60 * 1000

export interface DayDivider {
  readonly kind: 'day'
  readonly key: string
  /** `YYYY-MM-DD` of the day the following messages were sent on, in the viewer's time zone. */
  readonly dayKey: string
  readonly isToday: boolean
}

export interface MessageGroup {
  readonly kind: 'group'
  readonly key: string
  readonly author: SquadChatMessage['author']
  /** The viewer wrote it: the window draws it on the right. */
  readonly own: boolean
  /** Oldest first; the header shows the first message's time. */
  readonly messages: readonly SquadChatMessage[]
}

export type ChatTimelineEntry = DayDivider | MessageGroup

export interface GroupMessagesOptions {
  readonly viewerId: string | undefined
  /** IANA zone the days are read in. The viewer's own zone when omitted. */
  readonly timeZone?: string
  /** What counts as today. The current instant when omitted. */
  readonly now?: Date
}

function dayKeyOf(instant: string | Date, timeZone: string | undefined): string {
  // The `en-CA` locale writes a date as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant))
}

function continuesGroup(group: MessageGroup, message: SquadChatMessage): boolean {
  if (group.author.id !== message.author.id) return false
  const previous = group.messages.at(-1)
  if (!previous) return false
  return Date.parse(message.createdAt) - Date.parse(previous.createdAt) <= GROUP_WINDOW_MS
}

/**
 * Lays the messages out as the window draws them: a day divider whenever the day changes, and under it
 * groups of one author's consecutive messages, each at most two minutes after the one before. A new day
 * always opens a new group. `messages` must already be ordered oldest first.
 */
export function groupMessages(
  messages: readonly SquadChatMessage[],
  options: GroupMessagesOptions
): ChatTimelineEntry[] {
  const todayKey = dayKeyOf(options.now ?? new Date(), options.timeZone)
  const entries: ChatTimelineEntry[] = []
  let currentDay: string | null = null

  for (const message of messages) {
    const dayKey = dayKeyOf(message.createdAt, options.timeZone)

    // A divider is the last entry on a new day, so a message after one always opens a new group.
    if (dayKey !== currentDay) {
      entries.push({ kind: 'day', key: `day:${dayKey}`, dayKey, isToday: dayKey === todayKey })
      currentDay = dayKey
    }

    const last = entries.at(-1)
    if (last?.kind === 'group' && continuesGroup(last, message)) {
      entries[entries.length - 1] = { ...last, messages: [...last.messages, message] }
      continue
    }

    entries.push({
      kind: 'group',
      key: `group:${message.id}`,
      author: message.author,
      own: message.author.id === options.viewerId,
      messages: [message],
    })
  }

  return entries
}
