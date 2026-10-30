import { formSchema } from './create-squad-form'

/** The message the Discord field shows when the link fails the contract. */
export type DiscordLinkErrorKey = 'discordLinkInvalid' | 'discordLinkNotValid'

export type DiscordLinkCheck =
  | { readonly valid: true }
  | { readonly valid: false; readonly errorKey: DiscordLinkErrorKey }

/**
 * Whether a link passes the contract's Discord rule, and the message to show when it does not. It
 * asks the shared schema, so the live mark and the submit read the same rule: a link that is no
 * URL is "invalid", and a URL that is no Discord invite is "not valid".
 */
export function checkDiscordLink(link: string): DiscordLinkCheck {
  const result = formSchema.shape.discordLink.safeParse(link)
  if (result.success) return { valid: true }

  return {
    valid: false,
    errorKey:
      result.error.issues[0]?.code === 'custom' ? 'discordLinkNotValid' : 'discordLinkInvalid',
  }
}
