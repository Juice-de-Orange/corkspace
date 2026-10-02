import { atom } from 'signia'
import type { Tag } from '../../api/tags'

/** Admin-managed tag catalog (id → tag), loaded on board start; drives chips + rule styling. */
export const tagsAtom = atom<ReadonlyMap<string, Tag>>('tags', new Map())

export function loadTags(tags: readonly Tag[]): void {
  const m = new Map<string, Tag>()
  for (const t of tags) {
    m.set(t.id, t)
  }
  tagsAtom.set(m)
}

export function upsertTag(tag: Tag): void {
  const next = new Map(tagsAtom.value)
  next.set(tag.id, tag)
  tagsAtom.set(next)
}

export function removeTag(id: string): void {
  const next = new Map(tagsAtom.value)
  if (next.delete(id)) {
    tagsAtom.set(next)
  }
}
