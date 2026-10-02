import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteUser, patchUser } from '../src/services/users'
import { adminCreds, createTestApp, login, type TestApp, viewerCreds } from './helpers/app'

const json = (cookie: string) => ({ cookie, 'content-type': 'application/json' })

describe('admin user management — role / password / delete (super-admin)', () => {
  let ctx: TestApp
  let admin: string
  let viewer: string

  beforeAll(async () => {
    ctx = await createTestApp()
    admin = await login(ctx.app, adminCreds.email, adminCreds.password)
    viewer = await login(ctx.app, viewerCreds.email, viewerCreds.password)
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  const createUser = async (
    email: string,
    password: string,
    name: string,
    role?: 'admin' | 'user',
  ): Promise<{ id: string; role: string }> => {
    const res = await ctx.app.request('/api/admin/users', {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({ email, password, name, ...(role ? { role } : {}) }),
    })
    expect(res.status).toBe(201)
    return (await res.json()) as { id: string; role: string }
  }
  const listUsers = async (): Promise<Array<{ id: string; name: string; role: string }>> =>
    (await (
      await ctx.app.request('/api/admin/users', { headers: { cookie: admin } })
    ).json()) as Array<{
      id: string
      name: string
      role: string
    }>
  const patch = (id: string, body: unknown, cookie = admin) =>
    ctx.app.request(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: json(cookie),
      body: JSON.stringify(body),
    })
  const del = (id: string, cookie = admin) =>
    ctx.app.request(`/api/admin/users/${id}`, { method: 'DELETE', headers: { cookie } })

  it('creates an admin directly via the role field in POST', async () => {
    const created = await createUser('newadmin@example.com', 'password123', 'NA', 'admin')
    expect(created.role).toBe('admin')
    // a real admin reaches the super-admin surface
    const cookie = await login(ctx.app, 'newadmin@example.com', 'password123')
    expect((await ctx.app.request('/api/admin/users', { headers: { cookie } })).status).toBe(200)
    // remove it so later admin-count assertions see only the seeded admin
    expect((await del(created.id)).status).toBe(200)
  })

  it('promotes a user to admin (who then passes the guard) and demotes back', async () => {
    const u = await createUser('promote@example.com', 'password123', 'P')
    const before = await login(ctx.app, 'promote@example.com', 'password123')
    expect(
      (await ctx.app.request('/api/admin/users', { headers: { cookie: before } })).status,
    ).toBe(403)

    expect((await patch(u.id, { role: 'admin' })).status).toBe(200)
    const after = await login(ctx.app, 'promote@example.com', 'password123')
    expect((await ctx.app.request('/api/admin/users', { headers: { cookie: after } })).status).toBe(
      200,
    )

    // demote allowed while the seeded admin remains
    expect((await patch(u.id, { role: 'user' })).status).toBe(200)
  })

  it('renames a user and resets the password (new logs in, old does not)', async () => {
    const u = await createUser('pw@example.com', 'oldpassword1', 'Old')
    expect((await patch(u.id, { name: 'Renamed', password: 'newpassword9' })).status).toBe(200)
    expect((await listUsers()).find((x) => x.id === u.id)?.name).toBe('Renamed')
    expect(await login(ctx.app, 'pw@example.com', 'newpassword9')).toContain('=')
    await expect(login(ctx.app, 'pw@example.com', 'oldpassword1')).rejects.toThrow()
  })

  it('refuses to demote the last super-admin (lockout guard)', async () => {
    const res = await patch(ctx.adminId, { role: 'user' })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe('last_admin')
    expect((await listUsers()).find((x) => x.id === ctx.adminId)?.role).toBe('admin')
  })

  it('the last-admin guard is atomic at the service level (demote + delete both refuse the sole admin)', async () => {
    // Exercises the FOR-UPDATE-locked guard directly (bypassing the route self-delete guard). Only the
    // seeded admin exists, so both refuse and leave it intact — no admin-less lockout is reachable.
    expect(await patchUser(ctx.testDb.db, ctx.adminId, { role: 'user' })).toEqual({
      ok: false,
      reason: 'last_admin',
    })
    expect(await deleteUser(ctx.testDb.db, ctx.adminId)).toEqual({
      ok: false,
      reason: 'last_admin',
    })
    expect((await listUsers()).find((x) => x.id === ctx.adminId)?.role).toBe('admin')
  })

  it('refuses self-deletion', async () => {
    const res = await del(ctx.adminId)
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe('self_delete')
  })

  it('deletes a user; they disappear from the list and can no longer log in', async () => {
    const u = await createUser('doomed@example.com', 'password123', 'Doomed')
    expect((await del(u.id)).status).toBe(200)
    expect((await listUsers()).some((x) => x.id === u.id)).toBe(false)
    await expect(login(ctx.app, 'doomed@example.com', 'password123')).rejects.toThrow()
  })

  it('enforces RBAC + validation (non-admin 403, 404 unknown, 400 invalid)', async () => {
    const ZERO = '00000000-0000-0000-0000-000000000000'
    // a normal user cannot manage users
    expect((await patch(ctx.viewerId, { role: 'admin' }, viewer)).status).toBe(403)
    expect((await del(ctx.viewerId, viewer)).status).toBe(403)
    // unknown id
    expect((await patch(ZERO, { role: 'user' })).status).toBe(404)
    expect((await del(ZERO)).status).toBe(404)
    // empty / invalid body
    expect((await patch(ctx.viewerId, {})).status).toBe(400)
    expect((await patch(ctx.viewerId, { role: 'root' })).status).toBe(400)
  })
})
