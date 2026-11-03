import { useEffect, useState } from 'react'

/** How long a typed search or tag waits for the next keystroke before it reaches the URL. */
const TEXT_DEBOUNCE_MS = 300

interface DebouncedUrlText {
  /** What the URL holds for this text. */
  readonly urlText: string
  /** Whether `text` already says what the URL says. It must keep its identity while the URL does. */
  readonly inSync: (text: string) => boolean
  /** Writes the text to the URL. It must keep its identity while the URL does. */
  readonly commit: (text: string) => void
}

/**
 * A text input's local state, decoupled from the URL so typing is not held up by it. The text reaches
 * the URL after 300ms without a keystroke, and the URL's text flows back into the input when it
 * changes (back, forward or a shared link). That flow is adjusted while rendering, not in an effect,
 * so an input never paints the text it had before.
 */
export function useDebouncedUrlText({ urlText, inSync, commit }: DebouncedUrlText) {
  const [text, setText] = useState(urlText)
  const [shownUrlText, setShownUrlText] = useState(urlText)

  if (shownUrlText !== urlText) {
    setShownUrlText(urlText)
    if (!inSync(text)) setText(urlText)
  }

  useEffect(() => {
    if (inSync(text)) return
    const timer = setTimeout(() => commit(text), TEXT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, inSync, commit])

  return [text, setText] as const
}
