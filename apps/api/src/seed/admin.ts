import { randomUUID } from 'node:crypto'
import type { Database } from '@corkspace/db'
import { account, user } from '@corkspace/db/schema'
import type { Env } from '@corkspace/shared'
import { hash } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'

/**
 * Idempotently create the admin account from env. Sign-up is disabled, so we write the
 * user + a `credential` account row (argon2id password) directly — matching what Better
 * Auth's email/password provider expects. No-op if the admin email already exists.
 */
export async function seedAdmin(
  db: Database,
  env: Env,
): Promise<{ created: boolean; userId: string }> {
  const email = env.ADMIN_EMAIL.toLowerCase()
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  if (existing[0]) {
    return { created: false, userId: existing[0].id }
  }

  const userId = randomUUID()
  const now = new Date()
  const passwordHash = await hash(env.ADMIN_PASSWORD)

  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      name: env.ADMIN_NAME,
      email,
      emailVerified: true,
      role: 'admin',
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
  })

  return { created: true, userId }
}
