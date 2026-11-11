import { renderSquadImage, SIZE } from './render'

export const size = SIZE
export const contentType = 'image/png'
export const alt = 'Squadzr spike image'

export default function Image() {
  return renderSquadImage('SPIKE')
}
