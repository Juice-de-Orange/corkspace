import type { PartialSettings, Settings } from '@corkspace/shared'
import type { BoardAccess } from '../canvas/state/board-store'

export interface BoardSummary {
  id: string
  name: string
  ownerId: string
  ownerName: string
  level: 'owner' | 'editor' | 'viewer'
}

export interface BoardMetaResponse {
  id: string
  name: string
  ownerId: string
  rawSettings: PartialSettings
  globalDefaults: PartialSettings
  effectiveSettings: Settings
  access: BoardAccess
}

export interface MemberRow {
  userId: string
  email: string
  name: string
  role: 'editor' | 'viewer'
  showFurniture: boolean
}

export interface ShareRow {
  id: string
  token: string
  label: string | null
  showFurniture: boolean
  revokedAt: string | null
  createdAt: string
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

const opts = (method: string, body?: unknown): RequestInit => ({
  method,
  credentials: 'include',
  ...(body !== undefined
    ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : {}),
})

// ---- Board load ----
export async function fetchBoardMeta(boardId: string): Promise<BoardMetaResponse> {
  return asJson(await fetch(`/api/boards/${boardId}`, { credentials: 'include' }))
}

export async function fetchPublicBoard(
  token: string,
): Promise<{ boardId: string; effectiveSettings: Settings }> {
  return asJson(await fetch(`/api/public/${encodeURIComponent(token)}/board`))
}

export async function apiPatchBoard(
  boardId: string,
  patch: { name?: string; settings?: PartialSettings },
): Promise<void> {
  await asJson(await fetch(`/api/boards/${boardId}`, opts('PATCH', patch)))
}

// ---- Members ----
export async function fetchMembers(boardId: string): Promise<MemberRow[]> {
  return asJson(await fetch(`/api/boards/${boardId}/members`, { credentials: 'include' }))
}

export async function apiInviteMember(
  boardId: string,
  input: { email: string; role: 'editor' | 'viewer'; showFurniture: boolean },
): Promise<{ ok: boolean; error?: string; status: number }> {
  const res = await fetch(`/api/boards/${boardId}/members`, opts('POST', input))
  return { ok: res.ok, status: res.status, ...(res.ok ? {} : { error: await res.text() }) }
}

export async function apiRemoveMember(boardId: string, userId: string): Promise<void> {
  await asJson(await fetch(`/api/boards/${boardId}/members/${userId}`, opts('DELETE')))
}

// ---- Shares ----
export async function fetchShares(boardId: string): Promise<ShareRow[]> {
  return asJson(await fetch(`/api/boards/${boardId}/shares`, { credentials: 'include' }))
}

export async function apiCreateShare(
  boardId: string,
  input: { label?: string | null; showFurniture: boolean },
): Promise<{ id: string; token: string }> {
  return asJson(await fetch(`/api/boards/${boardId}/shares`, opts('POST', input)))
}

export async function apiRevokeShare(boardId: string, shareId: string): Promise<void> {
  await asJson(await fetch(`/api/boards/${boardId}/shares/${shareId}`, opts('DELETE')))
}
