# Squadzr Redesign v2

Source of the redesign canvas published at <https://claude.ai/artifact/WQieJFtthB1oeHRQprWdCP>. The canvas is the working copy; these files are a snapshot of it.

Each `.dc.html` file is one artboard. The files need the canvas runtime (`support.js`) and the canvas's uploaded images (`/_blob/…`), so they do not render when opened straight from disk. Open the canvas link to see them.

`canvas.json` holds the artboard layout and titles.

## Screens

| File | Screen |
| --- | --- |
| `Main.dc.html` | Landing page |
| `Board.dc.html` | Squad board |
| `BoardFiltros.dc.html` | Board with the filters open |
| `BoardNotificacoes.dc.html` | Board with the notifications open |
| `Squad.dc.html` | Squad room while forming |
| `SquadCompleto.dc.html` | Squad room once complete, with the Discord invite |
| `SquadGrande.dc.html` | Squad room for 10 players, with member pages |
| `CriarSquad.dc.html` | Create-squad modal, step 1: game search |
| `CriarSquadDetalhes.dc.html` | Create-squad modal, step 2: details |
| `CriarSquadDiscord.dc.html` | Create-squad modal, step 3: Discord link |
| `CardStates.dc.html` | Squad card states and hover |

## Components

| File | Component |
| --- | --- |
| `Biblioteca.dc.html` | Component library: colors, type and every variant below |
| `Button.dc.html` | Button |
| `Tag.dc.html` | Tag, language chip, filter toggle, suggestion, removable chip |
| `Avatar.dc.html` | Avatar with presence, host crown and open slot |
| `MemberTile.dc.html` | Squad member or open slot |
| `SlotMeter.dc.html` | Slot meter |
| `Segmented.dc.html` | Segmented control |
| `Pagination.dc.html` | Pagination |
| `SearchField.dc.html` | Search field and game combobox |
| `Steps.dc.html` | Step indicator |
| `NotificationItem.dc.html` | Squad-ready notification |
| `DiscordInvite.dc.html` | Discord invite, locked and unlocked |
| `SquadCard.dc.html` | Squad card |
| `Sidebar.dc.html` | Side menu |

Hover states and animations for the components live in each screen's `<style>` block under the `.ds-` prefix, because the canvas keeps a component's own styles inline only.
