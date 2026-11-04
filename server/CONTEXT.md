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
A Squad that has reached its required capacity and no longer accepts membership changes.
_Avoid_: Ready Room, completed room, waiting room

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
