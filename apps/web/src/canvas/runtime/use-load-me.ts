import { useEffect } from 'react'
import type { BoardSummary } from '../../api/boards'
import { defaultBoardIdAtom, myBoardsAtom, type Role, userRoleAtom } from '../state/user-store'

interface MeResponse {
  role?: Role
  defaultBoardId?: string | null
  boards?: BoardSummary[]
}

/** Load the current user's identity: instance role, default board, and board list. */
export function useLoadMe(): void {
  useEffect(() => {
    void fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<MeResponse>) : null))
      .then((d) => {
        if (!d) {
          return
        }
        if (d.role) {
          userRoleAtom.set(d.role)
        }
        defaultBoardIdAtom.set(d.defaultBoardId ?? null)
        myBoardsAtom.set(d.boards ?? [])
      })
      .catch(() => {})
  }, [])
}
