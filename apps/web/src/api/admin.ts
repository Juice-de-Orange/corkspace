import type { PartialSettings } from '@corkspace/shared'

export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
}
export interface AdminBoard {
  id: string
  name: string
  ownerId: string
  ownerName: string
  ownerEmail: string
  createdAt: string
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function adminListUsers(): Promise<AdminUser[]> {
  return asJson(await fetch('/api/admin/users', { credentials: 'include' }))
}

export async function adminCreateUser(input: {
  email: string
  password: string
  name: string
  role?: 'admin' | 'user'
}): Promise<{ ok: boolean; status: number }> {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return { ok: res.ok, status: res.status }
}

export async function adminListBoards(): Promise<AdminBoard[]> {
  return asJson(await fetch('/api/admin/boards', { credentials: 'include' }))
}

export async function adminGetSettings(): Promise<{ defaults: PartialSettings }> {
  return asJson(await fetch('/api/admin/settings', { credentials: 'include' }))
}

export async function adminPutSettings(defaults: PartialSettings): Promise<void> {
  await asJson(
    await fetch('/api/admin/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(defaults),
    }),
  )
}

/** Update a user's role / name / password (super-admin). */
export async function adminPatchUser(
  id: string,
  patch: { role?: 'admin' | 'user'; name?: string; password?: string },
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return { ok: res.ok, status: res.status }
}

/** Delete a user (super-admin). */
export async function adminDeleteUser(id: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return { ok: res.ok, status: res.status }
}
