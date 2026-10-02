import type { FrameMeta } from '../canvas/state/frame-store'
import { boardApi } from './board-context'

interface FrameResponse {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  color: string | null
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`frame request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

const toFrame = (r: FrameResponse): FrameMeta => ({
  id: r.id,
  name: r.name,
  x: r.x,
  y: r.y,
  w: r.width,
  h: r.height,
  color: r.color ?? null,
})

export async function fetchFrames(): Promise<FrameMeta[]> {
  const rows = await asJson<FrameResponse[]>(
    await fetch(boardApi('/frames'), { credentials: 'include' }),
  )
  return rows.map(toFrame)
}

export async function apiCreateFrame(input: {
  name: string
  x: number
  y: number
  width: number
  height: number
}): Promise<FrameMeta> {
  return toFrame(
    await asJson<FrameResponse>(
      await fetch(boardApi('/frames'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    ),
  )
}

export async function apiMoveFrame(id: string, dx: number, dy: number): Promise<void> {
  const res = await fetch(boardApi(`/frames/${id}/move`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dx, dy }),
  })
  if (!res.ok) {
    throw new Error(`move frame failed: ${res.status}`)
  }
}

export async function apiDeleteFrame(id: string): Promise<void> {
  const res = await fetch(boardApi(`/frames/${id}`), { method: 'DELETE', credentials: 'include' })
  if (!res.ok) {
    throw new Error(`delete frame failed: ${res.status}`)
  }
}
