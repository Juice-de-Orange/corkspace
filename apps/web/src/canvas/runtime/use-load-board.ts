import { useEffect, useState } from 'react'
import { setCurrentBoard, setPublicToken } from '../../api/board-context'
import { fetchBoardMeta, fetchPublicBoard } from '../../api/boards'
import { applySettings } from '../../lib/apply-settings'
import {
  boardAccessAtom,
  boardMetaAtom,
  boardSettingsAtom,
  PUBLIC_ACCESS,
} from '../state/board-store'
import { resetBoardClientState } from '../state/reset-board'

export type BoardTarget = { kind: 'board'; boardId: string } | { kind: 'token'; token: string }

/**
 * Resolve the board context (id/token + access + effective settings) BEFORE any content loads.
 * Sets the board-context module (so `boardApi()` resolves) and the board atoms, applies the
 * appearance settings, and reports `ready` so the caller can gate the content load.
 */
export function useLoadBoard(target: BoardTarget | null): { ready: boolean; error: boolean } {
  const [state, setState] = useState<{ ready: boolean; error: boolean }>({
    ready: false,
    error: false,
  })
  const key = target
    ? target.kind === 'board'
      ? `b:${target.boardId}`
      : `t:${target.token}`
    : null

  // `key` is the stable identity of `target` (which is a fresh object each render); depend on it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: target is captured via the stable key
  useEffect(() => {
    if (!target) {
      return
    }
    let cancelled = false
    setState({ ready: false, error: false })
    // Entering a (new) board: wipe per-tenant transient client state. The undo history, selection
    // and in-flight gestures are module singletons that survive a client-side board/account switch
    // (React remount ≠ page reload); without this, Undo could replay the previous board's commands
    // into this one (cross-account leak). Board DATA is reloaded separately by useLoadEntries.
    resetBoardClientState()
    void (async () => {
      try {
        if (target.kind === 'token') {
          setPublicToken(target.token)
          const b = await fetchPublicBoard(target.token)
          if (cancelled) {
            return
          }
          boardAccessAtom.set(PUBLIC_ACCESS)
          boardSettingsAtom.set(b.effectiveSettings)
          boardMetaAtom.set({ id: b.boardId, name: '' })
          applySettings(b.effectiveSettings)
        } else {
          setCurrentBoard(target.boardId)
          const b = await fetchBoardMeta(target.boardId)
          if (cancelled) {
            return
          }
          boardAccessAtom.set(b.access)
          boardSettingsAtom.set(b.effectiveSettings)
          boardMetaAtom.set({ id: b.id, name: b.name })
          applySettings(b.effectiveSettings)
        }
        if (!cancelled) {
          setState({ ready: true, error: false })
        }
      } catch {
        if (!cancelled) {
          setState({ ready: false, error: true })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  return state
}
