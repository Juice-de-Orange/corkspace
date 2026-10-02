import { atom } from 'signia'

export interface TeleportMeta {
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

export const teleportsAtom = atom<ReadonlyMap<string, TeleportMeta>>('teleports', new Map())

export function loadTeleports(rows: TeleportMeta[]): void {
  teleportsAtom.set(new Map(rows.map((t) => [t.id, t])))
}

export function upsertTeleport(t: TeleportMeta): void {
  const next = new Map(teleportsAtom.value)
  next.set(t.id, t)
  teleportsAtom.set(next)
}

export function removeTeleport(id: string): void {
  const next = new Map(teleportsAtom.value)
  if (next.delete(id)) {
    teleportsAtom.set(next)
  }
}
