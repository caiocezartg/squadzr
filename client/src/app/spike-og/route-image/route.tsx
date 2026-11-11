import { type CoverVariant, renderSquadImage } from '../render'

export function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code') ?? 'ROUTE'
  const cover = (new URL(request.url).searchParams.get('v') ?? 'full') as CoverVariant
  return renderSquadImage(code.slice(0, 8).toUpperCase(), cover)
}
