import 'server-only'
import type { Metadata } from 'next'
import type { PublicRoomDto } from '@squadzr/schemas'
import messages from '@/locales/en.json'
import type { Game } from '@/types'
import { publicSquadSource } from './server-squad-source'
import { readSquadDetails } from './squad-details'

/** The metadata of a page with no Squad to preview: a missing, Ready or expired Squad, or a failed read. */
const GENERIC_METADATA: Metadata = { title: { absolute: 'Squadzr' } }

/**
 * The invite preview of a Squad link. The Squad and its game come from the public projection, read
 * anonymously and never cached, so the preview shows what a visitor sees and nothing more. A Ready,
 * expired or missing Squad answers 404 to a visitor and gets the generic metadata, as does a failed read.
 */
export async function lobbyMetadata(squadCode: string): Promise<Metadata> {
  try {
    const details = await readSquadDetails(publicSquadSource, squadCode)
    if (!details?.game) return GENERIC_METADATA

    return invitePreview(details.response.room, details.game)
  } catch (error) {
    console.error('Lobby metadata read failed; the link gets the generic metadata:', error)
    return GENERIC_METADATA
  }
}

function invitePreview(squad: PublicRoomDto, game: Game): Metadata {
  const title = `${squad.name} · ${game.name}`
  const description = describeSquad(squad)
  const images = [game.coverUrl]

  return {
    title,
    description,
    openGraph: { title, description, images },
    twitter: { card: 'summary_large_image', title, description, images },
  }
}

/** The Squad's size, language and tags, in the order a visitor reads them. */
function describeSquad(squad: PublicRoomDto): string {
  const language = squad.language === 'pt-br' ? messages.languages.ptBr : messages.languages.enUs
  const parts = [`Up to ${squad.maxPlayers} players`, language]
  if (squad.tags.length > 0) parts.push(squad.tags.map((tag) => `#${tag}`).join(' '))

  return parts.join(' · ')
}
