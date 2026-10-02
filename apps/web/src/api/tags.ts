import type { TagStyle } from '@corkspace/shared'
import { boardApi } from './board-context'

export interface Tag {
  id: string
  name: string
  color: string
  styleRules: TagStyle
}

export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch(boardApi('/tags'), { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`tags failed: ${res.status}`)
  }
  return res.json() as Promise<Tag[]>
}

export async function apiCreateTag(input: {
  name: string
  color: string
  styleRules?: TagStyle
}): Promise<Tag> {
  const res = await fetch(boardApi('/tags'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw new Error(`create tag failed: ${res.status}`)
  }
  return res.json() as Promise<Tag>
}

export async function apiDeleteTag(id: string): Promise<void> {
  const res = await fetch(boardApi(`/tags/${id}`), { method: 'DELETE', credentials: 'include' })
  if (!res.ok) {
    throw new Error(`delete tag failed: ${res.status}`)
  }
}

/** Atomically replace an entry's tag set. */
export async function apiSetEntryTags(entryId: string, tagIds: string[]): Promise<void> {
  const res = await fetch(boardApi(`/tags/assign/${entryId}`), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tagIds }),
  })
  if (!res.ok) {
    throw new Error(`assign tags failed: ${res.status}`)
  }
}
