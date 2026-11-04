import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDialogPresence } from './use-dialog-presence'

describe('useDialogPresence', () => {
  it('starts unmounted and closed', () => {
    const { result } = renderHook(() => useDialogPresence())

    expect(result.current).toMatchObject({ mounted: false, open: false })
  })

  it('mounts and opens on show', () => {
    const { result } = renderHook(() => useDialogPresence())

    act(() => result.current.show())

    expect(result.current).toMatchObject({ mounted: true, open: true })
  })

  it('stays mounted while closing and unmounts when the exit has finished', () => {
    const { result } = renderHook(() => useDialogPresence())
    act(() => result.current.show())

    act(() => result.current.hide())
    expect(result.current).toMatchObject({ mounted: true, open: false })

    act(() => result.current.exited(false))
    expect(result.current).toMatchObject({ mounted: false, open: false })
  })

  it('ignores the end of an enter and a hide that nothing asked for', () => {
    const { result } = renderHook(() => useDialogPresence())

    act(() => result.current.hide())
    expect(result.current.mounted).toBe(false)

    act(() => result.current.show())
    act(() => result.current.exited(true))
    act(() => result.current.exited(false))
    expect(result.current).toMatchObject({ mounted: true, open: true })
  })

  it('hands out a new key on every show, so a dialog shown again starts fresh', () => {
    const { result } = renderHook(() => useDialogPresence())
    act(() => result.current.show())
    const first = result.current.key

    act(() => result.current.hide())
    act(() => result.current.show())

    expect(result.current).toMatchObject({ mounted: true, open: true })
    expect(result.current.key).not.toBe(first)

    // The old dialog's exit finishing late must not close the new one.
    act(() => result.current.exited(false))
    expect(result.current).toMatchObject({ mounted: true, open: true })
  })
})
