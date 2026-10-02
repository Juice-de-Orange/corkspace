import { atom } from 'signia'

export interface FrameMeta {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  color: string | null
}

export const framesAtom = atom<ReadonlyMap<string, FrameMeta>>('frames', new Map())

export function loadFrames(rows: FrameMeta[]): void {
  framesAtom.set(new Map(rows.map((f) => [f.id, f])))
}

export function upsertFrame(f: FrameMeta): void {
  const next = new Map(framesAtom.value)
  next.set(f.id, f)
  framesAtom.set(next)
}

export function removeFrame(id: string): void {
  const next = new Map(framesAtom.value)
  if (next.delete(id)) {
    framesAtom.set(next)
  }
}
