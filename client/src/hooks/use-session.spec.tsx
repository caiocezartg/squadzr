import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession } from '@/lib/auth-client'
import { createHarnessNavigation } from '@/test/navigation'
import { signInAsFakeUser, signOutFakeUser } from '@/test/stubs'
import { useEndSession, useSession } from './use-session'

function SessionProbe() {
  const session = useSession()
  return <p>{session ? `signed in as ${session.user.name}` : 'signed out'}</p>
}

function EndSessionButton() {
  const endSession = useEndSession()
  return <button onClick={endSession}>end session</button>
}

function focusWindow(): Promise<void> {
  return act(async () => {
    window.dispatchEvent(new Event('focus'))
  })
}

/** Lets a browser check that has started run to its end: it loads its modules, then asks Better Auth. */
function settleChecks(): Promise<void> {
  return act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
}

/** Waits for the check after mount, so a change to the auth store is then seen only by a focus check. */
async function settleMountCheck(): Promise<void> {
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1))
  await settleChecks()
}

/** A browser check the test holds open until it chooses the answer. */
function heldCheck() {
  let answer: (result: unknown) => void = () => undefined
  const promise = new Promise<unknown>((resolve) => {
    answer = resolve
  })
  return { promise, answer }
}

function signedInAnswer(name: string) {
  const user = { id: 'user-1', name, email: 'caio@squadzr.test', image: null }
  return { data: { user, session: { id: 'session-1' } }, error: null }
}

beforeEach(() => {
  vi.mocked(getSession).mockClear()
})

describe('SessionProvider', () => {
  it('starts from the session the server read, before the browser checks it', async () => {
    signInAsFakeUser({ name: 'Ana' })

    render(<SessionProbe />)

    expect(screen.getByText('signed in as Ana')).toBeInTheDocument()
    await settleMountCheck()
  })

  it('checks the session with Better Auth once after mount', async () => {
    render(<SessionProbe />)

    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1))
    await settleChecks()
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('checks the session again when the window regains focus', async () => {
    render(<SessionProbe />)
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1))

    await focusWindow()

    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
  })

  it('updates the session and refreshes the route when the check finds it changed', async () => {
    signInAsFakeUser({ name: 'Ana' })
    const navigation = createHarnessNavigation('/')
    render(<SessionProbe />)
    await settleMountCheck()
    signOutFakeUser()

    await focusWindow()

    expect(await screen.findByText('signed out')).toBeInTheDocument()
    expect(navigation.calls).toContainEqual({ method: 'refresh' })
  })

  it('does not refresh the route when the check agrees with the session', async () => {
    signInAsFakeUser({ name: 'Ana' })
    const navigation = createHarnessNavigation('/')
    render(<SessionProbe />)
    await settleMountCheck()

    await focusWindow()
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
    await settleChecks()

    expect(screen.getByText('signed in as Ana')).toBeInTheDocument()
    expect(navigation.calls).not.toContainEqual({ method: 'refresh' })
  })

  it('keeps the session the page has when the check rejects with a network error', async () => {
    signInAsFakeUser({ name: 'Ana' })
    const navigation = createHarnessNavigation('/')
    render(<SessionProbe />)
    await settleMountCheck()
    vi.mocked(getSession).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await focusWindow()
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
    await settleChecks()

    expect(screen.getByText('signed in as Ana')).toBeInTheDocument()
    expect(navigation.calls).not.toContainEqual({ method: 'refresh' })
  })

  it('keeps the session the page has when the check itself fails', async () => {
    signInAsFakeUser({ name: 'Ana' })
    const navigation = createHarnessNavigation('/')
    render(<SessionProbe />)
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1))
    await settleChecks()
    vi.mocked(getSession).mockResolvedValueOnce({
      data: null,
      error: { status: 500, message: 'Network error' },
    } as never)

    await focusWindow()
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
    await settleChecks()

    expect(screen.getByText('signed in as Ana')).toBeInTheDocument()
    expect(navigation.calls).not.toContainEqual({ method: 'refresh' })
  })

  it('applies only the latest check when an older check answers last', async () => {
    signInAsFakeUser({ name: 'Ana' })
    const navigation = createHarnessNavigation('/')
    const mountCheck = heldCheck()
    const focusCheck = heldCheck()
    vi.mocked(getSession)
      .mockReturnValueOnce(mountCheck.promise as never)
      .mockReturnValueOnce(focusCheck.promise as never)
    render(<SessionProbe />)
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1))
    await focusWindow()
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))

    // The focus check answers first with a signed-out viewer, then the older mount check answers.
    await act(async () => {
      focusCheck.answer({ data: null, error: null })
    })
    expect(await screen.findByText('signed out')).toBeInTheDocument()
    await act(async () => {
      mountCheck.answer(signedInAnswer('Ana'))
    })
    await settleChecks()

    expect(screen.getByText('signed out')).toBeInTheDocument()
    expect(navigation.calls.filter((call) => call.method === 'refresh')).toHaveLength(1)
  })
})

describe('useEndSession', () => {
  it('ends the session at once, without asking Better Auth', async () => {
    signInAsFakeUser({ name: 'Ana' })
    render(
      <>
        <SessionProbe />
        <EndSessionButton />
      </>
    )
    await settleMountCheck()

    fireEvent.click(screen.getByRole('button', { name: 'end session' }))

    expect(screen.getByText('signed out')).toBeInTheDocument()
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('keeps the session ended when a check that was in flight answers signed in', async () => {
    signInAsFakeUser({ name: 'Ana' })
    const navigation = createHarnessNavigation('/')
    const focusCheck = heldCheck()
    render(
      <>
        <SessionProbe />
        <EndSessionButton />
      </>
    )
    await settleMountCheck()
    vi.mocked(getSession).mockReturnValueOnce(focusCheck.promise as never)
    await focusWindow()
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: 'end session' }))
    await act(async () => {
      focusCheck.answer(signedInAnswer('Ana'))
    })
    await settleChecks()

    expect(screen.getByText('signed out')).toBeInTheDocument()
    expect(navigation.calls).not.toContainEqual({ method: 'refresh' })
  })
})
