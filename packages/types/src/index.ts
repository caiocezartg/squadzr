// @squadzr/types holds only shared static types that have no runtime
// representation (ADR-0001). Every HTTP and WebSocket contract is a Zod schema
// in @squadzr/schemas, which also exports the transport types inferred from it,
// so a type that can be validated at runtime never belongs here.
export {}
