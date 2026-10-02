import type { TeleportMeta } from '../canvas/state/teleport-store'
import { boardApi } from './board-context'

interface TeleportResponse {
  id: string
  name: string
  x: number
  y: number
  zoom: number
  isBoardButton: boolean
  boardX: number | null
  boardY: number | null
  icon: string | null
  color: string | null
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`teleport request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

const toTeleport = (r: TeleportResponse): TeleportMeta => ({
  id: r.id,
  name: r.name,
  x: r.x,
  y: r.y,
  zoom: r.zoom,
  isBoardButton: r.isBoardButton,
  boardX: r.boardX ?? null,
  boardY: r.boardY ?? null,
  icon: r.icon ?? null,
  color: r.color ?? null,
})

export async function fetchTeleports(): Promise<TeleportMeta[]> {
  const rows = await asJson<TeleportResponse[]>(
    await fetch(boardApi('/teleports'), { credentials: 'include' }),
  )
  return rows.map(toTeleport)
}

export async function apiCreateTeleport(input: {
  name: string
  x: number
  y: number
  zoom: number
  isBoardButton?: boolean
  boardX?: number | null
  boardY?: number | null
}): Promise<TeleportMeta> {
  return toTeleport(
    await asJson<TeleportResponse>(
      await fetch(boardApi('/teleports'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    ),
  )
}

export async function apiDeleteTeleport(id: string): Promise<void> {
  const res = await fetch(boardApi(`/teleports/${id}`), {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`delete teleport failed: ${res.status}`)
  }
}
