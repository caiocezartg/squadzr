'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from '@/hooks/use-session'
import { signInWithDiscord } from '@/lib/auth-client'
import { whenIdle } from '@/lib/when-idle'
import type { CreateSquadDialog } from '@/features/squad-creation'
import { CreateSignInPrompt } from './create-sign-in-prompt'

type CreateDialogComponent = typeof CreateSquadDialog

// The dialog loads on its own, so the Lobby's initial JavaScript does not carry it. The shell preloads it
// when the page is idle.
const loadCreateDialog = () => import('@/features/squad-creation').then((m) => m.CreateSquadDialog)

interface CreateSquadLauncher {
  /** Opens the create dialog for a signed-in viewer, and asks a visitor to sign in first. */
  readonly requestCreate: () => void
}

const CreateSquadLauncherContext = createContext<CreateSquadLauncher | undefined>(undefined)

/** The shell's way to start creating a squad, from the sidebar or from a page's own button. */
export function useCreateSquadLauncher(): CreateSquadLauncher {
  const launcher = useContext(CreateSquadLauncherContext)
  if (!launcher) throw new Error('useCreateSquadLauncher needs a CreateSquadLauncher above it')
  return launcher
}

/**
 * Owns the one create-Squad dialog of the shell, so it opens the same way on the board and in the
 * Lobby. The dialog never shows a loading state: it is fetched when the page is idle, and a request
 * that comes sooner waits for it before it opens. A visitor gets a sign-in prompt instead, which
 * returns to the same page with `?create=1`, and a signed-in viewer who arrives with `?create=1` gets
 * the dialog once, with the parameter dropped.
 */
export function CreateSquadLauncher({ children }: { readonly children: ReactNode }) {
  const session = useSession()
  const pathname = usePathname()
  const params = useSearchParams()
  const signedIn = Boolean(session?.user)
  const [Dialog, setDialog] = useState<CreateDialogComponent | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)

  const openDialog = useCallback(async () => {
    const loaded = await loadCreateDialog()
    setDialog(() => loaded)
    setDialogOpen(true)
  }, [])

  const requestCreate = useCallback(() => {
    if (signedIn) void openDialog()
    else setPromptOpen(true)
  }, [signedIn, openDialog])

  useIdlePreload(signedIn)
  useCreateParameter({ signedIn, requestCreate })

  const closePrompt = () => {
    setPromptOpen(false)
    dropCreateParameter(pathname, params)
  }

  const launcher = useMemo(() => ({ requestCreate }), [requestCreate])

  return (
    <CreateSquadLauncherContext value={launcher}>
      {children}
      {Dialog && dialogOpen && signedIn && <Dialog onClose={() => setDialogOpen(false)} />}
      {promptOpen && !signedIn && (
        <CreateSignInPrompt
          onClose={closePrompt}
          onSignIn={() => void signInWithDiscord(createReturnPath(pathname, params))}
        />
      )}
    </CreateSquadLauncherContext>
  )
}

/** Fetches the create dialog once the browser has nothing else to do, so its first open is instant. */
function useIdlePreload(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    return whenIdle(() => void loadCreateDialog())
  }, [enabled])
}

/** Acts on `?create=1` when a page loads, once per visit to the URL. */
function useCreateParameter({
  signedIn,
  requestCreate,
}: {
  readonly signedIn: boolean
  readonly requestCreate: () => void
}): void {
  const pathname = usePathname()
  const params = useSearchParams()
  const wanted = params.get(CREATE_PARAMETER) === '1'

  useEffect(() => {
    if (!wanted) return

    requestCreate()
    // A visitor keeps the parameter, so the sign-in prompt's return path carries it.
    if (signedIn) dropCreateParameter(pathname, params)
  }, [wanted, signedIn, requestCreate, pathname, params])
}

const CREATE_PARAMETER = 'create'

/** The page the visitor is on, asking for the create dialog once they are back. */
function createReturnPath(pathname: string, params: URLSearchParams): string {
  const next = new URLSearchParams(params)
  next.set(CREATE_PARAMETER, '1')
  return `${pathname}?${next}`
}

/** Writes the URL without `?create=1`, the way the board writes its own search: no navigation, no request. */
function dropCreateParameter(pathname: string, params: URLSearchParams): void {
  const next = new URLSearchParams(params)
  next.delete(CREATE_PARAMETER)
  const search = next.size > 0 ? `?${next}` : ''
  window.history.replaceState(null, '', `${pathname}${search}`)
}
