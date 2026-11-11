import { z } from 'zod'

/** The languages the app ships messages for. */
export const localeSchema = z.enum(['en', 'pt-BR'])

export type Locale = z.infer<typeof localeSchema>

/** A request with no usable choice and no supported language reads English. */
export const DEFAULT_LOCALE: Locale = 'en'

/** Holds the chosen language: the language toggle writes it and the server reads it. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'
