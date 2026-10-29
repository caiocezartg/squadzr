# Redesign v2 — design reference

The implementation contract for the Redesign v2 screens. It is extracted from the canvas snapshot in this folder (`*.dc.html`, `screens/*.png`) and adds what the canvas leaves open: responsive behaviour, motion values and the deviations the product decisions require.

When this file and an artboard disagree, this file wins. When this file is silent, match the artboard and its PNG. Every styling or motion decision is checked against the `emil-design-eng` skill.

## 1. Foundations

### Colour tokens

| Token | Hex | Use |
| --- | --- | --- |
| `bg` | `#07080A` | Page background |
| `menu` | `#0B0C0F` | Sidebar, alternate landing sections, footer |
| `panel` | `#0F1013` | Panels, filter fields, Lobby info panels |
| `card` | `#121317` | Cards, search bar, user button |
| `raised` | `#17181D` | Popovers, hovered card, pagination idle, active nav item |
| `raised-2` | `#1A1B20` | Secondary button, tag chip, poster fallback |
| `line` | `#1F2026` | Borders, language chip, idle controls |
| `track` | `#24252B` | Empty meter segment, dividers, disabled ground |
| `text` | `#F2F3F5` | Primary text |
| `text-2` | `#C9CBD1` | Secondary text, tag text |
| `text-3` | `#A9ABB3` | Body copy on dark, counts |
| `muted` | `#80838C` | Labels, icons, meta |
| `faint` | `#5F626B` | Placeholders, codes, `/max` |
| `mint` | `#00FFA2` | Primary accent, online ring, active states |
| `mint-hover` | `#5CFFC4` | Primary button hover |
| `mint-ink` | `#03140D` | Text on mint |
| `amber` | `#FFB547` | Host crown, "one slot left" count |
| `discord` | `#4E5AE8` | Discord button and invite |
| `discord-hover` | `#5D68F0` | Discord button hover |
| `discord-soft` | `#8B93F5` | Ready meter, lock icon |
| `danger` | `#FF8A8A` | Danger text (ground `rgba(239,68,68,0.10)`, hover `0.18`) |

Corners are square everywhere. Only avatars, presence dots, the bell badge and the invite's server icon (16px radius) are round.

### Typography

Three families, loaded with `next/font/google` and exposed as CSS variables:

| Role | Family | Weight · size / line-height | Notes |
| --- | --- | --- | --- |
| Display | Big Shoulders | 900 · `clamp(88px, 11vw, 176px)` / 0.94 | Hero, uppercase |
| Section title | Big Shoulders | 900 · `clamp(56px, 6.4vw, 92px)` / 1 | Landing sections, uppercase |
| Page title | Big Shoulders | 900 · 60 / 0.96 | "Explorar squads", uppercase |
| Panel title | Big Shoulders | 900 · 40 (modal) or 28 (popover) / 1 | Uppercase |
| Squad name | Big Shoulders | 800 · 30 (lg card, Lobby) or 23 (md card) / 1.1 | Two-line clamp on cards |
| Counter | Big Shoulders | 800–900 · 20–64 / 1 | `4/5`, `04/05` |
| Body | Plus Jakarta Sans | 500 · 15 / 1.6 | |
| UI | Plus Jakarta Sans | 700–800 · 12.5–16 | Buttons, names, chips |
| Label and code | JetBrains Mono | 700 · 11 · letter-spacing 0.14em | Uppercase labels, `#VLR77` |

### Spacing and layout

- App shell: sidebar column 260px (`menu` ground, `inset -1px 0 0 #16171B` edge), main padding `30px 40px 48px`, vertical rhythm 18px.
- Landing: content max width 1240px, horizontal padding 24px, section padding 96–136px vertical.
- Touch targets are at least 44px tall on every interactive control (36px only for `sm` buttons inside desktop panels).

## 2. Components

Each component lives once in the client's UI layer and is reused by every screen. Variants and states follow the artboard named in brackets.

- **Button** (`Button.dc.html`): variants `primary`, `secondary`, `ghost`, `link`, `danger`, `discord`, `light`, `dark`, `glass`; sizes `sm` 36px, `md` 44px, `lg` 56px; icon at start or end; icon-only square; `mono` for codes; renders a link when it navigates. Disabled ground `track`, text `faint`. Every variant presses to `scale(0.97)`.
- **Tag** (`Tag.dc.html`): read-only `tag` (`#label`), `glass`, `lang` (globe icon), `lang-light`; buttons `toggle` (`aria-pressed`), `suggest` (`+ #label`), `removable` (× with an accessible "remove" label).
- **Avatar** (`Avatar.dc.html`): sizes 28/34/36/44; states `online` (mint ring with the halo pulse), `away` (grayscale 0.85, opacity 0.5, dashed outline), `open` (empty slot with a plus and the wait pulse), `vacant` (grey slot on cards), `none`; host crown on top. Shows the player's Discord image when present, otherwise initials on a colour pair picked deterministically from the player id (palette below).
- **Avatar palette** (bg / fg): `#0E4D3A/#B9FFE4`, `#3A2A5C/#E7DBFF`, `#5C3A1E/#FFE2C7`, `#1E3A5C/#CFE6FF`, `#5C1E3A/#FFD1E6`, `#4A4A1E/#F4F4C2`, `#1E4A4A/#C6F4F4`.
- **MemberTile** (`MemberTile.dc.html`): 64px row, avatar `lg`, name, "você" for the viewer; online, away (with "Fora da sala · há X min" as its accessible presence text and tooltip) and open slot ("Vaga aberta"). Grounds: online `#15161A`, away `#111215`, open `#0C0D10` with a 1px `raised-2` inset.
- **SlotMeter** (`SlotMeter.dc.html`): `blocks` (Lobby, 40px segments, 18px above 5 slots), `line` (sidebar, card rails), `pips` (filter options); tones mint, discord (Ready), amber. More than 10 slots collapse to 10 segments.
- **Segmented** (`Segmented.dc.html`): `sm` mono (language switch) and `md` (squad language, sort, filter language); fluid option; `aria-pressed` buttons in a labelled group.
- **Pagination** (`Pagination.dc.html`): 44px squares (40 in `sm`), mint current page (light tone in the Lobby), disabled ends.
- **SearchField** (`SearchField.dc.html`): `field` (54px, ring `track`, ring `mint` with a value, clear button) and `bare` (inside the board bar); combobox mode for the game search.
- **Steps** (`Steps.dc.html`): three steps, 3px bars, mono labels, check on done steps, `aria-current="step"`.
- **NotificationItem** (`NotificationItem.dc.html`): cover 38×50 with a Discord badge, Squad name, "Convite do Discord liberado", game and relative time; unread shows a 2px mint edge, bold name and a dot; read covers go grayscale 0.6; dismiss button appears on hover and focus.
- **DiscordInvite** (`DiscordInvite.dc.html`): locked bar (lock icon, "Liberado quando o squad completar", masked `discord.gg/••••••••`) and the unlocked "Bora pro Discord" panel, which sits in the members column (see Deviations). The Ready panel is the display title over one translucent server card: a 52px icon with the Discord badge, "CONVITE DO SERVIDOR" and the server name; a row of counts (Discord's online and member counts and the Squad's own "na sala agora"); a link row with the invite and both actions (a glass "Copiar link" that turns into "Copiado" for 1.8s, and the light "Abrir no Discord"), over the Discord blurple with the faded logo watermark, or the server's banner (its splash when it has no banner) as a dim backdrop. The icon, name and counts come from the Discord Preview the API reads from the invite. Without it (missing, invalid or expired invite, Discord down or rate limiting) the card shows the game's cover, the Squad's name and the counts "na sala agora" and "jogadores"; the card keeps the same structure and height, and a skeleton shows in the icon, name and counts only while a cold cache reads the preview for the first time. The locked panel has the same skeleton: the display title, a lock row, the slots left with the meter and the masked link over two dimmed actions, so the column does not jump when the Squad completes.
- **SquadCard** (`SquadCard.dc.html`, `CardStates.dc.html`): `md` (118px poster, 176px tall) and `lg` (160px poster, 214px tall); language tag, `#CODE`, name, up to 2 tags then `+N`, avatar rail of `min(max, 5)` circles (the first `min(members, 5)` filled from the member preview, the rest vacant) followed by `+N` with `N = max − 5` when `max` is above 5, count `members/max` (authoritative). States: open (a button that joins, CTA "Entrar"), joined (a link to the Lobby, "ENTROU" badge, CTA "Abrir sala"), full for a non-member (`aria-disabled`, grayscale poster, "CHEIO" overlay, opacity 0.62). The card's accessible name reads "name — game, language, n de max jogadores". The "PRONTO" state only appears where Ready Squads are listed.
- **Sidebar** (`Sidebar.dc.html`): logo, "Criar squad", join-by-code form, "Todos os squads" with the open count, "Meus squads" (cover, host crown, name, line meter, count; amber count when one slot is left; Discord badge and discord tone when Ready; current item with a mint edge), language switch, user button with presence dot and menu.

## 3. Screens

| Screen | Artboards | Notes |
| --- | --- | --- |
| Landing | `Main` | Own top navigation, no sidebar. Sections: hero, games (`#jogos`), how it works (`#como-funciona`), FAQ (`#faq`), CTA banner, footer with the IGDB credit. |
| Squad Board | `Board`, `BoardFiltros`, `BoardNotificacoes`, `CardStates` | 2-column grid of `lg` cards, 6 per page. Filters open in a popover anchored to the "Filtros" button; notifications in a popover anchored to the bell. |
| Lobby | `Squad`, `SquadCompleto`, `SquadGrande` | Cover panel (game label, name, language and tags, "Criado há X"), members panel (`04/05` counter, code copy button, blocks meter, 2-column member tiles, 8 per page with light pagination) with the invite under it in the same column, as wide as the panel. Header actions: "Explorar squads", "AO VIVO" connection status, "Copiar link do squad", the bell (wide widths), "Encerrar squad" (host) or "Sair do squad" (member), "Time fechado" once Ready. A signed-in non-member sees the cover, counter, preview tiles, the locked invite and "Entrar no squad". |
| Create Squad | `CriarSquad`, `CriarSquadDetalhes`, `CriarSquadDiscord` | Modal 680px wide, three steps. Step 1 searches games (popular games when empty, highlighted match, genre and size per result). Step 2: selected game with "Trocar jogo", name with counter, player stepper, squad language, tags with suggestions. Step 3: Discord link with live "VÁLIDO" state and a card preview. |

### Deviations from the canvas

- Squad codes have **6** characters (the sidebar artboard says 5).
- The squad name counter reads `n/30`; the name limit stays 30.
- Player counts run **2 to 40**; every "2 a 20" in the copy becomes "2 a 40".
- Copy never names a fixed number of games; the hero badge and the games section read `totalGames` from the API.
- "Sugerir um jogo" in the empty search state is dropped: there is no destination for it.
- `/squads/my` does not exist; "Meus squads" lives only in the sidebar.
- The board's tag filter accepts several tags; a Squad matches when it has every selected tag, compared exactly (case-insensitive, without `#`).
- Create Squad's "Popular now" games are rows in the game search's listbox (cover, name, genre and size), not the artboard's six-column cover grid (`CriarSquad`), so arrow keys move through one list.
- Avatars use the player's Discord image when there is one; the initials palette is the fallback.
- The Ready invite panel is not a full-width band: from 1024px up it sits under the members panel, in the right column and as wide as the panel, with the cover panel on the left, and below 1024px the order is cover, members, invite. The canvas's 72px title above a 64px-cover server card and a separate link row becomes a 34px title (40px from a 672px-wide panel) over one translucent card with a 52px icon, a row of counts and the link row, and the "SQUAD FECHADO" badge is dropped. The panel measures 306px tall at 1440 (700px wide, the link and both actions on one row) and 331px at 1280 and 1024 (540px and 376px wide, the actions under the link in two equal columns), 327px at 375; the locked panel is within a pixel of it at every width. The card shows the Discord server's icon, name and counts ("online", "membros") with the Squad's own "na sala agora", over the server's banner as a dim backdrop; without a preview it shows the game's cover, the Squad's name and "na sala agora" and "jogadores" over the logo watermark.

## 4. Responsive

There are no mobile artboards, so these rules are the contract. Widths: narrow is below 640px, medium is 640–1023px, wide is 1024px and up. Tailwind's min-width prefixes implement them; never read a prefix as a range.

- **App shell:** at wide widths the sidebar is a fixed 260px column and the bell sits in the page header. Below 1024px the sidebar becomes a drawer opened from a top bar that holds the logo, the bell and a menu button (the page header then has no bell); the drawer slides from the left, traps focus, closes with Escape and returns focus to the menu button.
- **Squad Board:** 2 columns of large cards at wide widths, 1 column of medium cards below 1024px. The page title drops to 44px below 640px. Filters and notifications open as popovers from 640px up, and as bottom sheets below 640px.
- **Lobby:** cover panel on the left and, at wide widths, the members panel with the invite under it on the right, so the cover stretches to the height of the column; stacked below 1024px (cover, members, invite), with the cover panel shortened to a 16:9 band. Member tiles: 2 columns from 640px up, 1 column below. Header actions wrap; below 640px the copy and leave actions become icon buttons with accessible labels.
- **Create Squad:** the modal is full screen below 640px, with the footer actions pinned to the bottom.
- **Landing:** the navigation collapses into a menu below 640px. The hero card and its toasts sit below the copy below 1024px, and the toasts hide below 640px. The games panel stacks above the list below 1024px. "Como funciona" is sticky only at wide widths (see Motion); below 1024px it is three stacked cards.
- Every screen is checked at 1440, 768 and 390px wide.

## 5. Motion

Values come from the canvas `.ds-` styles, corrected by the `emil-design-eng` rules.

### Tokens

| Token | Value |
| --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` |
| `--dur-press` | 160ms |
| `--dur-fast` | 150ms (hover colour, chips, segmented) |
| `--dur-ui` | 200ms (popovers, panels) |
| `--dur-modal` | 280ms enter, 180ms exit |

### Rules

- Animate `transform` and `opacity` only. The FAQ accordion is the one height animation.
- CSS transitions and `@starting-style` by default. The `motion` library only drives the scroll-linked "Como funciona", the hero demo's springs, the in-view reveal and the realtime member entrances, always with full `transform` strings.
- Exits are faster than entrances.
- Hover effects sit behind `@media (hover: hover) and (pointer: fine)`.
- Content that arrives ready (server render or warm cache) never animates in. No route-level loading states.
- Keyboard shortcuts take effect without a transition: Escape closes at once, arrow keys move the active option without one. Content that changes as a result (a step, an accordion panel) keeps its normal transition.
- `prefers-reduced-motion: reduce` keeps opacity and colour changes and removes movement, scale and loops. "Como funciona" becomes the stacked cards.

### Per element

| Element | Motion |
| --- | --- |
| Pressable controls | `scale(0.97)` on `:active`, `--dur-press` |
| Button and chip hover | background colour, `--dur-fast`, `ease` |
| Popovers (filters, notifications, user menu) | from `opacity 0; scale(0.96)` at the trigger's `transform-origin`, `--dur-ui` `--ease-out`; exit 150ms |
| Modal | from `opacity 0; translateY(16px) scale(0.985)`, `--dur-modal`, centred origin |
| Create Squad steps | content slides 12px in the travel direction (forward from the right, back from the left) with opacity, 240ms `--ease-out`; the step bar fills with it |
| Squad card hover | ground and 1.5px mint ring 200ms; poster `scale(1.03)` 400ms `--ease-out`; count fades out and the CTA slides 10px in (opacity 200ms, transform 250ms) |
| Board results | filters and pages swap content at once, with no transition |
| Sidebar current item | no transition |
| Online avatar | halo pulse 2.4s loop; open slot wait pulse 2.4s loop |
| Member joins (realtime) | avatar from `opacity 0; scale(0.9)`, spring `duration 0.4, bounce 0.15`; meter segment fills with a 200ms transition; counter swaps digits with a 150ms fade |
| Squad becomes Ready | meter turns fully mint; the invite panel enters from `opacity 0; translateY(14px) scale(0.99)` over 500ms `--ease-out`; the sheen sweeps once on entry, not in a loop |
| Copy feedback | label and icon crossfade with a 2px blur, 200ms |
| Toasts | Sonner defaults |
| FAQ | icon rotates 45° (250ms `--ease-out`); the answer's height and opacity animate 250ms |
| Landing sections | fade and rise 16px once when 15% enters the viewport, 400ms `--ease-out`; children stagger 50ms |
| Live dot | opacity pulse 1.6s loop |

### Hero

The hero card tells the product story once, 600ms after the hero becomes visible:

1. The card shows 2/5 members.
2. Every 900ms a member avatar enters (`scale(0.9)`, spring bounce 0.15) and a toast "X entrou · n/5" slides in from 14px right and leaves 1.6s later. The counter and meter follow.
3. At 5/5 the card's ring turns mint with a soft glow and the "Squad completo — convite liberado" bar rises 18px into place.
4. The card holds its final state. It does not loop.

The toasts are hidden below 640px. Under reduced motion the card renders its final state.

### "Como funciona"

- At wide widths, the section is a sticky stage inside a scroll track three viewports tall. The left column lists the three steps; the right shows the step's mockup.
- Scroll progress (motion's `useScroll` on the track) maps to the active step in thirds. The active step's numeral fills mint (the others stay outlined), and a 2px progress bar under each numeral fills linearly with its third.
- Mockups crossfade (opacity 300ms with a 2px blur bridge) when the active step changes. Inside each mockup the canvas's micro-animations play once on entry: the click on "Entrar com Discord", the search typing "valorant" and the pick, the last two members joining and the invite appearing.
- When the third step completes, the sticky stage releases with the rest of the page.
- Below 1024px and under reduced motion: three stacked cards with the section reveal, and the mockups in their final state.
