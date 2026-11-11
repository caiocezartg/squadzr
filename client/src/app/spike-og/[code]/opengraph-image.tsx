import { renderSquadImage, SIZE } from '../render'

export const size = SIZE
export const contentType = 'image/png'
export const alt = 'Squadzr spike Squad image'

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return renderSquadImage(code.slice(0, 8).toUpperCase())
}
