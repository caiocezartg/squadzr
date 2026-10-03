import { z } from 'zod'

// JSON has no date type: every transport date is an ISO 8601 UTC string
// (what `Date.prototype.toISOString()` produces), never a `Date` instance.
export const isoDateTimeSchema = z.iso.datetime()
