import type { StrokeMeta } from '../canvas/state/stroke-store'
import { boardApi } from './board-context'

interface StrokeResponse {
  id: string
  entryId: string | null
  points: number[][]
  color: string
  size: number
  tool: string
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`stroke request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

const toStroke = (r: StrokeResponse): StrokeMeta => ({
  id: r.id,
  entryId: r.entryId ?? null,
  points: r.points,
  color: r.color,
  size: r.size,
  tool: r.tool,
})

export async function fetchStrokes(): Promise<StrokeMeta[]> {
  const rows = await asJson<StrokeResponse[]>(
    await fetch(boardApi('/strokes'), { credentials: 'include' }),
  )
  return rows.map(toStroke)
}

export async function apiCreateStroke(input: {
  entryId?: string | null
  points: number[][]
  color: string
  size: number
  tool: string
}): Promise<StrokeMeta> {
  return toStroke(
    await asJson<StrokeResponse>(
      await fetch(boardApi('/strokes'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    ),
  )
}

export async function apiDeleteStroke(id: string): Promise<void> {
  const res = await fetch(boardApi(`/strokes/${id}`), { method: 'DELETE', credentials: 'include' })
  if (!res.ok) {
    throw new Error(`delete stroke failed: ${res.status}`)
  }
}
