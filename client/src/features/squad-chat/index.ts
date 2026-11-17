/**
 * Public interface of the Squad Chat capability: the data side of a Squad's chat and the pure helpers its
 * window draws with. The query key, the history cache and the optimistic send stay internal. The Lobby
 * reaches the chat only through this entry, and the chat never imports from the Lobby.
 *
 * - `SquadChatDock` is the Lobby's chat: the launcher and the window it opens, holding the chat's data.
 * - `useSquadChat` reads the history (latest page, older pages on demand), merges live messages from the
 *   Lobby's channel, counts unread ones while the window is closed and sends the viewer's messages. Hold it
 *   above the chat window, so a pending send survives the window closing.
 * - `useSquadTyping` says who is typing in the Squad, for the members panel and the chat footer; hold it
 *   where both can read it. `useTypingSender` (used by the dock) signals the viewer's own typing.
 * - `SquadChat.cooldown` and `SquadChat.readOnly` are the composer's two locks: the anti-spam cooldown
 *   (it ends by itself) and the Ready Squad's read-only chat.
 * - `useSquadChatCommands` drops a Squad's chat cache when the viewer loses access to it.
 * - `groupMessages` lays the messages out as the window draws them: day dividers and author groups.
 */
export {
  useSquadChat,
  type SendChatOutcome,
  type SquadChat,
  type SquadChatChannel,
  type SquadChatStatus,
  type UseSquadChatOptions,
} from './use-squad-chat'
export {
  useSquadTyping,
  type SquadTyping,
  type SquadTypingChannel,
  type TypingMember,
  type UseSquadTypingOptions,
} from './use-squad-typing'
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
export { SquadChatDock, type SquadChatDockProps } from './components/squad-chat-dock'
