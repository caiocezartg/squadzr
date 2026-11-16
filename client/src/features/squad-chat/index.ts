/**
 * Public interface of the Squad Chat capability: the data side of a Squad's chat and the pure helpers its
 * window draws with. The query key, the history cache and the optimistic send stay internal. The Lobby
 * reaches the chat only through this entry, and the chat never imports from the Lobby.
 *
 * - `SquadChatDock` is the Lobby's chat: the launcher and the window it opens, holding the chat's data.
 * - `useSquadChat` reads the history (latest page, older pages on demand), merges live messages from the
 *   Lobby's channel, counts unread ones while the window is closed and sends the viewer's messages. Hold it
 *   above the chat window, so a pending send survives the window closing.
 * - `useSquadChatCommands` drops a Squad's chat cache when the viewer loses access to it.
 * - `groupMessages` lays the messages out as the window draws them: day dividers and author groups.
 * - `linkifyText` splits a message body into text and safe links.
 */
export {
  useSquadChat,
  type SendChatOutcome,
  type SquadChat,
  type SquadChatChannel,
  type SquadChatStatus,
  type UseSquadChatOptions,
} from './use-squad-chat'
export { useSquadChatCommands, type SquadChatCommands } from './squad-chat-commands'
export { type SquadChatMessage } from './squad-chat-message'
export {
  GROUP_WINDOW_MS,
  groupMessages,
  type ChatTimelineEntry,
  type DayDivider,
  type GroupMessagesOptions,
  type MessageGroup,
} from './group-messages'
export { linkifyText, type LinkifySegment } from './linkify-text'
export { SquadChatDock, type SquadChatDockProps } from './components/squad-chat-dock'
