/** A Squad code has 6 characters; a longer one from the URL is cut, so it cannot stretch the screen. */
const SQUAD_CODE_LENGTH = 6

/** The code from the URL as the large mark of a Lobby notice: `#` and at most a code's 6 characters. */
export function SquadCodeMark({ code }: { readonly code: string }) {
  return (
    <span className="text-text-2 block font-mono text-[clamp(36px,9vw,64px)] leading-none font-bold tracking-[0.14em] whitespace-nowrap">
      #{code.slice(0, SQUAD_CODE_LENGTH)}
    </span>
  )
}
