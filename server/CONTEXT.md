# Server Context

This context owns the concepts and rules used to form and coordinate Squads.

## Language

**Squad**:
A group being formed for a multiplayer match, with a fixed capacity, the Platform it plays on (when its Game has any), a code to join it and, once Ready, a Discord invite for its members. Every Squad payload carries a summary of its Game, including the Game's aliases as stored, so the Squad Board can search by them without asking the catalog.
_Avoid_: Room, party, premade, lobby

**Platform**:
Where a Squad's group plays a Game, one of a fixed list in display order: PC, PS5, PS4, Xbox Series, Xbox One, Switch 2, Switch and Mobile. A Game carries the Platforms the Catalog Import found for it (possibly none), and a Squad carries exactly one of its Game's Platforms, chosen by the host when forming it: it is required when the Game has Platforms and absent when it has none, and `POST /api/rooms` refuses anything else with 400 `INVALID_PLATFORM`. It is not a store (Steam, Epic) and a Squad has only one, so crossplay is not modelled. A Squad created before Platforms existed has none.
_Avoid_: Store, launcher, console, device

**Membership**:
The durable association between a user and a Squad.
_Avoid_: Presence, connection, viewer

**Presence**:
The transient participation of a member in a Squad's live experience. A member is online while at least one healthy live session is participating in that Squad.
_Avoid_: Membership, player

**Squad Activity**:
The most recent durable change to a Squad's membership.
_Avoid_: Room Activity, Presence, connection, view

**Open Squad**:
A Squad that is accepting new memberships while it is being formed.
_Avoid_: Open Room, waiting room, active room

**Ready Squad**:
A Squad that has reached its required capacity and no longer accepts membership changes. The join that fills it also writes its Squad Record and runs the Squad Release of its members. The cleanup deletes it 60 minutes after it became Ready; its Squad Record stays.
_Avoid_: Ready Room, completed room, waiting room

**Squad Record**:
The immutable account of a Squad that became Ready: its Game, name, Platform, host, size, the instant it became Ready and every member it had then, each with the time they joined. It is written by the join that fills the Squad, in that join's transaction, after the roster is read and before the Squad Release, so a failure rolls the whole join back. It is keyed by the Squad's id, which has no foreign key because the cleanup deletes the Squad, so writing it twice changes nothing and its members are written only by the call that created it. Nothing alters or deletes a record (deleting a member's account removes only their line, and the host is left empty). An Open Squad that expired never has one. Migration 0009 gave a record to each Ready Squad that still existed. It is what the Player Profile counts.
_Avoid_: History entry, completed squad row, match

**Player Profile**:
What anyone may read about a person (`GET /api/users/:id/profile`, public): their name and photo, when they joined Squadzr, how many Squads they completed (the Squad Records they are a member of), in how many Games, their latest Squad and their five most played Games. The Games are ordered by Squads, then by the most recent Ready, then by name, and a Game that left the catalog still counts. It never carries the email, the Discord id, the Squads themselves or who the person played with, and an unknown id is 404 `USER_NOT_FOUND`.
_Avoid_: User page, public user, stats

**Squad Limits**:
How many Open Squads one person can be in, both counted over valid Open Squads at the moment of the write. A person hosts at most 1 Open Squad (`ROOM.CREATE_LIMIT`), also when a Host Transfer would make them host, and holds at most 3 Memberships in Open Squads (`ROOM.JOIN_LIMIT`), the one they host included. Creating a Squad checks both, the host limit first (422 `ROOM_CREATE_LIMIT_REACHED`, then 422 `ROOM_JOIN_LIMIT_REACHED`), and joining checks the Membership limit. Ready Squads and Open Squads past their activity window do not count, so whoever just completed a Squad can create or join another at once.
_Avoid_: Room limit, quota, cap

**Squad Release**:
What happens to a person's other Open Squads when a Squad they are in becomes Ready: in the same transaction as the final join, every member of the Ready Squad leaves every other valid Open Squad. Ready Squads and expired Open Squads keep their Memberships. A Squad that loses its host goes through a Host Transfer; one that is left empty is deleted. Each Squad that continues advances its Squad Activity. It is automatic and only follows a Squad becoming Ready: leaving by hand is unchanged, and a host who leaves a Squad by hand still deletes it.
_Avoid_: Auto-leave, cleanup, kick

**Host Transfer**:
The handover of a Squad whose host left in a Squad Release. The remaining member who has been in it the longest (ties go to the smaller user id) and does not host another valid Open Squad becomes its host, so nobody ever hosts two; the Discord invite stays the same. When no remaining member is eligible, the Squad is closed: it is deleted and its remaining members are told. People are chosen Squad by Squad in ascending id order, and someone who just inherited one is no longer eligible for the next. It never happens when a host leaves by hand.
_Avoid_: Host change, promotion, ownership transfer

**User Notification**:
A persisted message for one person about a Squad, one type per action. `room_ready` goes to every member of a Squad that became Ready and lists the other Squads they left; it is the only type that gets the Discord invite, resolved when it is read and never stored. `host_transferred` goes to the member who inherited a Squad. `member_left` goes to the host a Squad has after a Squad Release, once for each member who left and was not the old host. `room_closed` goes to every remaining member of a Squad closed for lack of an eligible host. Only `room_ready` is stored once per Squad and person; the others repeat, because a host is told again for each member who leaves. A Squad deleted for being left empty tells nobody.
_Avoid_: Alert, message, inbox item

**Discord Preview**:
The public data Discord holds for the invite of a Ready Squad: its server's name, icon, backdrop and member counts. Only a member of a Ready Squad may read it. The server reads it from Discord and keeps each answer for ten minutes, except an invite Discord does not know or a Discord that could not be reached, which it keeps for one minute so a mistyped or just-created invite is asked about again soon; when Discord has nothing to show (an invalid or expired invite, Discord down or rate limiting) the preview is absent and the Squad's own data stands in. The same provider also verifies an invite before its Squad exists: creating a Squad asks Discord about the invite and refuses one Discord does not know with 422 `INVALID_DISCORD_INVITE`, while a Discord that cannot be reached, or an invite that expires, lets the Squad through. `GET /api/discord/invites/:code` (authenticated) gives the create form the same check while the host types: `valid` with the server and whether the invite expires, `invalid`, or `unknown` when Discord could not be asked. There is no rate limit on it yet; the cache is the only protection for Discord.
_Avoid_: Server info, invite metadata, Discord card

**Game**:
A multiplayer title in the Game Catalog that a Squad can be formed for. Its squad size and featured placement follow the Catalog Import's curated rules, not the raw source data, and its Platforms are the supported ones the source lists for it. It also carries aliases, the nicknames and acronyms (IGDB's alternative names, without the executable names and paths it also lists, plus a manual list) that Game Search matches next to its name.
_Avoid_: Title, product, game entry

**Game Catalog**:
The set of Games Squads can be formed for, brought in line by the Catalog Import instead of a static seed. A Game is identified by its IGDB id.
_Avoid_: Game list, games table, catalog list

**Listed Game**:
A Game that appears in the Game Catalog and can be chosen when forming a Squad. A delisted Game keeps its row so existing Squads still render, but the Catalog Import does not count it as today's catalog and only the Catalog Import relists it.
_Avoid_: Active game, visible game, enabled game

**Game Search**:
How a player finds a Listed Game by typing in the create-Squad dialog (`GET /api/games?search=`). The term and each Game's name and aliases are first folded the same way: accents removed, lowercase, every run of characters that are not letters or digits turned into one space. "Counter strike", "COUNTER-STRIKE" and "Counter-Strike 2" then match, "pokemon" matches "Pokémon", and the percent sign, the underscore and the backslash are plain punctuation, never wildcards. A Game matches when its folded name or an alias contains the folded term or, from three letters on, when a word of it is similar enough to the term to tolerate an incomplete term ("valorat") or a wrong letter in a long word; it does not tolerate a transposition in a short word. How similar depends on the length of the folded term, counted in characters: one or two characters never use similarity; three or four need a `word_similarity` of 0.7, so "lol" finds League of Legends by its alias but not Lost Ark (0.5), which only starts alike; five or more need 0.5. Results come in this order: a name or alias exactly equal to the term ("league" before "League of Legends"), a name that starts with the term, a name that contains it, then the ones found only by similarity, the closest first; ties break by Popularity, name and id. A term with nothing but punctuation gives the same suggestions as no term: Featured Games first, then Popularity. A term is at most 100 characters.
_Avoid_: Autocomplete, fuzzy search, game filter

**Popularity**:
A Game's integer score from 0 to 10000 for how much it is played right now, computed by the Catalog Import from the source's Playing and Steam 24hr Peak Players signals: each signal becomes a percentile among the candidates that have it (the top one is 1.0, ties share a percentile, a missing signal is 0) and the higher percentile, times 10000, is the score. Without a search, Featured Games come first and the rest follow by Popularity.
_Avoid_: Rating count, rank, hotness

**Featured Game**:
A Listed Game the curated list highlights, ordered by its featured rank.
_Avoid_: Highlight, promoted game, top game

**Catalog Import**:
One run that brings the Game Catalog in line with the candidates of a Game Catalog Source: it upserts, delists and relists Games, applies the curated squad sizes and featured ranks, stores each Game's Platforms, and changes nothing when a safety check or a write fails.
_Avoid_: Seed, sync job, IGDB import

**Admin**:
A person whose role is `admin` rather than `user`. Admins alone can open the admin panel and call `/api/admin/*` (anyone else is refused with 401 `UNAUTHORIZED` when signed out and 403 `ADMIN_REQUIRED` otherwise). The role lives on the user, reaches the session as a required field and is checked against the database on every request, so a demotion applies at once. Nobody can set it through sign-up or a profile update. The first admin is made by the `admin:grant` server script, which takes a user id or a Discord id (the account id of the user's Discord account), is safe to run twice and never demotes. We own this role instead of installing the Better Auth admin plugin (`docs/adr/0005-own-the-admin-role.md`).
_Avoid_: Moderator, superuser, staff

**Audit Entry**:
The append-only account of one admin action: who did it (an actor id that goes null when that admin's account is deleted, plus a name snapshot), the action (`role_changed`, `squad_closed`, `catalog_import_requested` or `admin_granted`), a snapshot of what it touched (a Squad's id, name, code and game, or a user's id and name), the reason when the action has one, details such as the old and new role, and when it happened. The snapshots keep it readable after the Squad or the person is gone, and nothing updates or deletes an entry. An action nobody took through the panel, the grant script, has no actor and the panel shows it as "System". `GET /api/admin/audit` lists the entries newest first, 20 per page.
_Avoid_: Log line, history row, event

