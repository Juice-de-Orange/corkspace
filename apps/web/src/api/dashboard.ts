import type { Graph, SearchParams } from '@corkspace/shared'
import { boardApi } from './board-context'

export interface SearchResult {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  snippet: string
}

export async function apiSearch(body: SearchParams): Promise<SearchResult[]> {
  const res = await fetch(boardApi('/dashboard/search'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`search failed: ${res.status}`)
  }
  return res.json() as Promise<SearchResult[]>
}

export interface TrashItem {
  id: string
  type: string
  snippet: string
}

export async function apiTrash(): Promise<TrashItem[]> {
  const res = await fetch(boardApi('/dashboard/trash'), { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`trash failed: ${res.status}`)
  }
  return res.json() as Promise<TrashItem[]>
}

export async function apiRestore(id: string): Promise<void> {
  const res = await fetch(boardApi(`/dashboard/entries/${id}/restore`), {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`restore failed: ${res.status}`)
  }
}

export interface EntryVersion {
  id: string
  versionAt: string
}

export async function apiVersions(entryId: string): Promise<EntryVersion[]> {
  const res = await fetch(boardApi(`/dashboard/entries/${entryId}/versions`), {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`versions failed: ${res.status}`)
  }
  return res.json() as Promise<EntryVersion[]>
}

export async function apiRestoreVersion(entryId: string, versionId: string): Promise<void> {
  const res = await fetch(boardApi(`/dashboard/entries/${entryId}/versions/${versionId}/restore`), {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`version restore failed: ${res.status}`)
  }
}

export interface OrphanItem {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
}

export async function apiOrphans(): Promise<OrphanItem[]> {
  const res = await fetch(boardApi('/dashboard/orphans'), { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`orphans failed: ${res.status}`)
  }
  return res.json() as Promise<OrphanItem[]>
}

export interface DashboardStats {
  entries: number
  deleted: number
  connections: number
}

export async function apiStats(): Promise<DashboardStats> {
  const res = await fetch(boardApi('/dashboard/stats'), { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`stats failed: ${res.status}`)
  }
  return res.json() as Promise<DashboardStats>
}

export async function apiGraph(): Promise<Graph> {
  const res = await fetch(boardApi('/dashboard/graph'), { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`graph failed: ${res.status}`)
  }
  return res.json() as Promise<Graph>
}
