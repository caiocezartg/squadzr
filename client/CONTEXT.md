# Client Context

The web app where players find Squads, join them and follow them live. It presents the Server context's Squads through views and reuses its language (Squad, Membership, Presence, Open Squad, Ready Squad).

## Language

**Squad Board**:
The public board of Open Squads that a player can browse and join. Its search field filters the Squads already loaded, folding the term like Game Search does, and matches a Squad by its name, its Game's name or one of its Game's aliases ("lol" finds League of Legends).
_Avoid_: Catalog, lobby, room list, room browser

**Lobby**:
The live view of a single Squad for its members: who is in it, their Presence and, once the Squad is Ready, its Discord invite. A signed-in player who is not in the Squad sees its non-member view instead: the cover, the counter, a preview of its members and its open slots, and the invite locked, with a way to join. That view has no Presence and no live channel, and a visitor sees only a sign-in prompt.
_Avoid_: Squad Board, room page, waiting room

**My Squads**:
The view of the Squads a player hosts or holds a Membership in, including Ready Squads during their retention.
_Avoid_: My Rooms, dashboard, my lobbies

**Squad Chat**:
The chat window of a Squad's Lobby, shown only to its members behind a floating "Chat" button at the bottom-right: a non-modal panel above the button from 640px, a bottom sheet below. It lists the latest Chat Messages, other members' on the left and the viewer's on the right, grouped by author within 2 minutes under one header, with a day divider when the day changes. The viewer's message shows at once as pending under its client-generated id and the server's message replaces it; a failed send removes it and puts the text back in the composer. Links in a message (`http://`, `https://`, `www.`) are clickable and open in a new tab. The skeleton shows only the first time the window opens, never on a warm cache. While another member types, their tile in the members panel shows three mint dots beside the name and the window's footer reads "Ana is typing…" or "N people are typing…"; an entry ends 4 seconds after the last signal or when that member's message arrives. The viewer's own typing is never shown, and a Ready Squad shows none. When a Ready Squad's chat turns read-only, with the window open or not, a banner "Squad complete — the chat is now read-only" replaces the composer, the draft and any Cooldown are dropped, and a pending message refused as Ready is removed.
_Avoid_: Chatbox, messenger, DM

**Cooldown**:
The wait after a member sends 5 Chat Messages in 10 seconds, or after the API refuses a send as rate-limited: the composer shows an amber "Easy there — send again in Ns" over a bar that drains to empty, cannot send, keeps the draft editable and unlocks by itself. The client counts its own stored sends, so it usually starts before the server has to refuse; a server refusal starts it from `retryAfterMs`, else `Retry-After`, else 10 seconds. Screen readers hear it once when it starts.
_Avoid_: Timeout, mute, slow mode

**Chat Message**:
One entry of a Squad Chat as the member sees it: the author's name, avatar, the `HH:mm` send time and the body, which is always rendered as text, never as HTML.
_Avoid_: Post, comment

**Notification**:
One row of the bell's panel, one per action that happened to the viewer's Squads, drawn by its type with its own media, badge and message: a Squad that filled (the game cover with a Discord badge, and the Squads the viewer left for it), a Squad the viewer inherited (the cover with a crown), a member who left (their avatar), and a Squad that was closed (a grey cover). All but the last open the Squad's Lobby; a closed Squad has no Lobby, so its row opens the Squad Board. Any notification pushed to the viewer also reads My Squads again, because a Squad Release changes the viewer's list.
_Avoid_: Alert, toast, message

**Player Profile**:
A dialog (a bottom sheet below 768px) that shows a person's photo, name, when they joined, how many Squads they completed, in how many Games, their latest Squad and their five most played Games, each with a bar sized against the first. The URL carries it as `?player=<id>`, so it opens over whichever page is below it without leaving it (the Lobby keeps its live channel and Presence), a shared link opens it over the Squad Board, and Back closes it. It opens from a member's photo or name on a Lobby tile, in the member view and in the non-member one, and from "My profile" in the account menu; the Squad card's photos and the notifications do not open it. A profile already seen opens at once from the cache and is read again in the background; the skeleton is only for a person nobody read before, and hovering a tile reads the profile ahead. A person with no completed Squad shows only their identity and an invitation to find a Squad (their own profile) or a sentence (anyone else's); the viewer's own profile carries a YOU mark.
_Avoid_: User page, public profile, player card
