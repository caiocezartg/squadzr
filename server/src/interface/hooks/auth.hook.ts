import type { FastifyRequest } from 'fastify'
import { UnauthorizedError } from '@application/errors'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

// Declares only the request fields the guard touches and takes no reply: a `FastifyRequest` or
// `FastifyReply` parameter would pin the route's generics to their defaults, so a controller typed
// by its route schema could no longer be bound as the handler.
type GuardedRequest = Pick<FastifyRequest, 'session' | 'userId'>

export async function requireAuth(request: GuardedRequest): Promise<void> {
  if (!request.session?.user?.id) {
    throw new UnauthorizedError()
  }
  request.userId = request.session.user.id
}
