import { randomUUID } from 'node:crypto'
import type { Database } from '@corkspace/db'
import { account, boards, user } from '@corkspace/db/schema'
import type { AdminPatchUserInput } from '@corkspace/shared'
import { hash } from '@node-rs/argon2'
import { and, eq } from 'drizzle-orm'

/** Create a credential user (argon2id) with an explicit role + their personal board. Returns null
 *  if the email exists. Sign-up is disabled, so accounts are only ever created here (seed) or by an
 *  admin. Every user owns exactly one board, created atomically here. */
export async function createUserWithPassword(
  db: Database,
  input: { email: string; password: string; name: string; role: 'admin' | 'user' },
): Promise<{ id: string; boardId: string } | null> {
  const email = input.email.toLowerCase()
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  if (existing.length > 0) {
    return null
  }
  const userId = randomUUID()
  const now = new Date()
  const passwordHash = await hash(input.password)
  const boardId = await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      name: input.name,
      email,
      emailVerified: true,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    })
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })
    const b = await tx
      .insert(boards)
      .values({ ownerId: userId, name: 'My board' })
      .returning({ id: boards.id })
    return b[0]?.id as string
  })
  return { id: userId, boardId }
}

export interface AdminUserRow {
  id: string
  email: string
  name: string
  role: string
}

/** Look up a user's core fields (existence + current role) for admin operations. */
export async function getUserById(db: Database, userId: string): Promise<AdminUserRow | null> {
  const rows = await db
    .select({ id: user.id, email: user.email, name: user.name, role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return rows[0] ?? null
}

/** Result of a guarded super-admin mutation (demote/delete): refused when it would remove the LAST
 *  instance super-admin, which would lock everyone out of the /admin surface. */
export type UserMutationResult = { ok: true } | { ok: false; reason: 'last_admin' }

/** Update any subset of a user's role / name / password (super-admin). A password resets the
 *  `credential` account row (argon2id), inserting one if the user somehow lacks it. Atomic. */
export async function patchUser(
  db: Database,
  userId: string,
  patch: AdminPatchUserInput,
): Promise<UserMutationResult> {
  const passwordHash = patch.password ? await hash(patch.password) : undefined
  const now = new Date()
  return db.transaction(async (tx): Promise<UserMutationResult> => {
    // Atomic last-admin guard: lock the admin set so concurrent demotions serialize and can't race
    // the instance into an admin-less lockout (a pre-check `countAdmins` was a TOCTOU hole).
    if (patch.role === 'user') {
      const admins = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.role, 'admin'))
        .for('update')
      if (admins.some((a) => a.id === userId) && admins.length <= 1) {
        return { ok: false, reason: 'last_admin' }
      }
    }
    if (patch.role !== undefined || patch.name !== undefined) {
      const set: { role?: string; name?: string; updatedAt: Date } = { updatedAt: now }
      if (patch.role !== undefined) {
        set.role = patch.role
      }
      if (patch.name !== undefined) {
        set.name = patch.name
      }
      await tx.update(user).set(set).where(eq(user.id, userId))
    }
    if (passwordHash !== undefined) {
      const updated = await tx
        .update(account)
        .set({ password: passwordHash, updatedAt: now })
        .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
        .returning({ id: account.id })
      if (updated.length === 0) {
        await tx.insert(account).values({
          id: randomUUID(),
          accountId: userId,
          providerId: 'credential',
          userId,
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        })
      }
    }
    return { ok: true }
  })
}

/** Delete a user; DB cascades remove their board (+ its content), memberships, accounts, sessions.
 *  Locks the admin set and refuses to remove the last super-admin (guards concurrent cross-deletion;
 *  the sole-admin case is also blocked at the route by the self-delete guard). */
export async function deleteUser(db: Database, userId: string): Promise<UserMutationResult> {
  return db.transaction(async (tx): Promise<UserMutationResult> => {
    const admins = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, 'admin'))
      .for('update')
    if (admins.some((a) => a.id === userId) && admins.length <= 1) {
      return { ok: false, reason: 'last_admin' }
    }
    await tx.delete(user).where(eq(user.id, userId))
    return { ok: true }
  })
}
