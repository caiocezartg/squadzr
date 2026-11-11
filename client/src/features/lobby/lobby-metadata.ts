import 'server-only'
import type { Metadata } from 'next'
import { createTranslator } from 'next-intl'
import {
  PLATFORM_LABELS,
  SQUAD_PREVIEW_IMAGE_SIZE,
  SQUAD_PREVIEW_IMAGE_TYPE,
  squadPreviewImagePath,
  type PublicRoomDto,
  type RoomLanguage,
  type SquadPreviewKey,
} from '@squadzr/schemas'
import { lobbyHref } from '@/lib/squad-links'
import { DEFAULT_PREVIEW, SITE_OPEN_GRAPH, SITE_TITLE } from '@/lib/site-metadata'
import en from '@/locales/en.json'
import ptBR from '@/locales/pt-BR.json'
import { publicSquadSource } from './server-squad-source'
import { readSquadDetails } from './squad-details'

/**
 * The metadata of a page with no Squad to preview: a missing, Ready or expired Squad, or a failed read.
 * It shows the landing's preview, never Squad details.
 */
const GENERIC_METADATA: Metadata = { title: { absolute: SITE_TITLE }, ...DEFAULT_PREVIEW }

/**
 * The invite preview of a Squad link. The Squad and its game come from the public projection, read
 * anonymously and never cached, so the preview shows what a visitor sees and nothing more. A Ready,
 * expired or missing Squad answers 404 to a visitor and gets the generic metadata, as does a failed read.
 */
export async function lobbyMetadata(squadCode: string): Promise<Metadata> {
  try {
    const details = await readSquadDetails(publicSquadSource, squadCode)
    if (!details) return GENERIC_METADATA

    return invitePreview(details.room)
  } catch (error) {
    console.error('Lobby metadata read failed; the link gets the generic metadata:', error)
    return GENERIC_METADATA
  }
}

/**
 * The title and description are the Squad's own, in the Squad's language. The image is the one every
 * Squad of the same game, slots and language shares, rendered by the `squadzr-og` Worker (GitHub #152),
 * so a Squad that gains a member points at the next image on its next share. Next replaces `openGraph`
 * and `twitter` instead of merging them, so both are built whole.
 */
function invitePreview(squad: PublicRoomDto): Metadata {
  const t = squadTranslator(squad.language)
  const key = previewKey(squad)
  const title = `${squad.name} · ${squad.game.name}`
  const description = describeSquad(squad, key, t)
  const image = {
    url: squadPreviewImagePath(key),
    ...SQUAD_PREVIEW_IMAGE_SIZE,
    alt: t('imageAlt', { game: squad.game.name, filled: key.filled, total: key.total }),
    type: SQUAD_PREVIEW_IMAGE_TYPE,
  }

  return {
    title,
    description,
    openGraph: {
      ...SITE_OPEN_GRAPH,
      url: lobbyHref(squad.code),
      title,
      description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

type PreviewTranslator = ReturnType<typeof squadTranslator>

/** The Squad's language picks the copy; the visitor's own locale does not. */
function squadTranslator(language: RoomLanguage) {
  const portuguese = language === 'pt-br'
  // Both files define the same keys (src/i18n/messages.spec.ts), so English types them both.
  const messages: typeof en = portuguese ? ptBR : en
  return createTranslator({
    locale: portuguese ? 'pt-BR' : 'en',
    messages,
    namespace: 'lobby.preview',
  })
}

/**
 * The image key of a Squad: its game, its slots and its language. A Squad always has its host, so the
 * count is at least one; when the projection leaves the count out, the members it previews stand in.
 */
function previewKey(squad: PublicRoomDto): SquadPreviewKey {
  const members = squad.memberCount ?? squad.memberPreview.length
  return {
    gameId: squad.game.id,
    filled: Math.min(Math.max(members, 1), squad.maxPlayers),
    total: squad.maxPlayers,
    language: squad.language,
  }
}

/** The open spots, language, platform and tags, in the order a visitor reads them. */
function describeSquad(squad: PublicRoomDto, key: SquadPreviewKey, t: PreviewTranslator): string {
  const parts = [t('openSpots', { open: key.total - key.filled, total: key.total }), t('language')]
  if (squad.platform) parts.push(PLATFORM_LABELS[squad.platform])
  if (squad.tags.length > 0) parts.push(squad.tags.map((tag) => `#${tag}`).join(' '))

  return parts.join(' · ')
}
