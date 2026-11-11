import { readCover } from './cover'
import { parseEnv } from './env'
import { apiGameSource } from './game-source'
import { handleImageRequest } from './handle-request'
import { renderSquadImage } from './render'

export default {
  async fetch(request: Request, bindings: unknown): Promise<Response> {
    const env = parseEnv(bindings)
    return handleImageRequest(request, {
      readGame: apiGameSource(env.API_URL, env.EDGE_AUTH_TOKEN),
      readCover,
      render: renderSquadImage,
    })
  },
}
