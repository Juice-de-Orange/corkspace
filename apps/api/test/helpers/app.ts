import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Database } from '@corkspace/db'
import { boardMembers, boardShares } from '@corkspace/db/schema'
import { startTestDb, type TestDb } from '@corkspace/db/testing'
import { type Env, parseEnv } from '@corkspace/shared'
import { type App, buildApp } from '../../src/app'
import { makeAuth } from '../../src/auth'
import { seedAdmin } from '../../src/seed/admin'
import { ensurePersonalBoard } from '../../src/services/board-access'
import { createUserWithPassword } from '../../src/services/users'

export const adminCreds = {
  email: 'admin@example.com',
  password: 'admin-password-123',
  name: 'Admin',
} as const

// A regular account that is a VIEWER member of the admin's board (the old "global viewer" role maps
// to a viewer membership now). Read-only + public-only on the admin board.
export const viewerCreds = {
  email: 'viewer@example.com',
  password: 'viewer-password-123',
  name: 'Viewer',
} as const

export interface TestApp {
  app: App
  env: Env
  testDb: TestDb
  adminId: string
  adminBoardId: string
  viewerId: string
  stop: () => Promise<void>
}

/** Create a credential user + their personal board (mirrors the admin flow). */
export async function createUserAccount(
  db: Database,
  creds: { email: string; password: string; name: string },
): Promise<{ id: string; boardId: string }> {
  const created = await createUserWithPassword(db, { ...creds, role: 'user' })
  if (!created) {
    throw new Error(`user already exists: ${creds.email}`)
  }
  return created
}

/** Add a user as a member of a board (editor|viewer). */
export async function addMember(
  db: Database,
  boardId: string,
  userId: string,
  role: 'editor' | 'viewer',
  showFurniture = true,
): Promise<void> {
  await db
    .insert(boardMembers)
    .values({ boardId, userId, role, showFurniture })
    .onConflictDoUpdate({
      target: [boardMembers.boardId, boardMembers.userId],
      set: { role, showFurniture },
    })
}

/** Create an external share token for a board; returns the token string. */
export async function createShareToken(
  db: Database,
  boardId: string,
  createdBy: string,
  showFurniture = true,
): Promise<string> {
  const token = randomUUID().replace(/-/g, '')
  await db.insert(boardShares).values({ boardId, token, createdBy, showFurniture })
  return token
}

/** Boot an ephemeral DB, seed the admin (+ board) and a viewer member, build the Hono app. */
export async function createTestApp(): Promise<TestApp> {
  const testDb = await startTestDb()
  const env = parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: testDb.url,
    BETTER_AUTH_SECRET: 'test-secret-value-at-least-16-chars',
    BETTER_AUTH_URL: 'http://localhost:3000',
    AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
    ADMIN_EMAIL: adminCreds.email,
    ADMIN_PASSWORD: adminCreds.password,
    ADMIN_NAME: adminCreds.name,
    ASSET_DIR: join(tmpdir(), `corkspace-assets-${randomUUID()}`),
  })
  const seeded = await seedAdmin(testDb.db, env)
  const adminBoardId = await ensurePersonalBoard(testDb.db, seeded.userId, 'My board')
  const viewer = await createUserAccount(testDb.db, viewerCreds)
  await addMember(testDb.db, adminBoardId, viewer.id, 'viewer')
  const auth = makeAuth(testDb.db, env)
  const app = buildApp({ db: testDb.db, env, auth })
  return {
    app,
    env,
    testDb,
    adminId: seeded.userId,
    adminBoardId,
    viewerId: viewer.id,
    stop: () => testDb.stop(),
  }
}

/** Sign in and return the session cookie (name=value) for subsequent requests. */
export async function login(app: App, email: string, password: string): Promise<string> {
  const res = await app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) {
    throw new Error(`login failed: ${res.status} ${await res.text()}`)
  }
  return setCookie.split(';')[0] ?? ''
}
