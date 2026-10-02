import type { ConnMeta } from '../canvas/state/connection-store'
import { boardApi } from './board-context'

interface ConnResponse {
  id: string
  fromEntryId: string
  toEntryId: string
  color: string
  label: string | null
  arrowStart: boolean
  arrowEnd: boolean
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`connection request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

const toConn = (r: ConnResponse): ConnMeta => ({
  id: r.id,
  fromEntryId: r.fromEntryId,
  toEntryId: r.toEntryId,
  color: r.color,
  label: r.label ?? null,
  arrowStart: r.arrowStart,
  arrowEnd: r.arrowEnd,
})

export async function fetchConnections(): Promise<ConnMeta[]> {
  const rows = await asJson<ConnResponse[]>(
    await fetch(boardApi('/connections'), { credentials: 'include' }),
  )
  return rows.map(toConn)
}

export async function apiCreateConnection(input: {
  fromEntryId: string
  toEntryId: string
  color?: string
  label?: string | null
}): Promise<ConnMeta> {
  return toConn(
    await asJson<ConnResponse>(
      await fetch(boardApi('/connections'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    ),
  )
}

export async function apiPatchConnection(
  id: string,
  patch: { color?: string; label?: string | null; arrowStart?: boolean; arrowEnd?: boolean },
): Promise<ConnMeta> {
  return toConn(
    await asJson<ConnResponse>(
      await fetch(boardApi(`/connections/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    ),
  )
}

export async function apiDeleteConnection(id: string): Promise<void> {
  const res = await fetch(boardApi(`/connections/${id}`), {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`delete connection failed: ${res.status}`)
  }
}
