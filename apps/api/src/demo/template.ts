import { randomBytes, randomUUID } from 'node:crypto'
import type { Database } from '@corkspace/db'
import { boards, session, user } from '@corkspace/db/schema'
import type { Env } from '@corkspace/shared'
import { and, eq, like, ne, sql } from 'drizzle-orm'
import { buildApp } from '../app'
import type { Auth } from '../auth'
import { type ApiCall, type Json, seedDemoBoard } from '../seed/demo-content'
import { createUserWithPassword } from '../services/users'

/**
 * The demo's data model (docs/demo.md): one TEMPLATE account owns the seed board; every visitor
 * becomes a GUEST account whose personal board starts as a copy of it. Nobody can sign in as either
 * (random passwords, e-mail sign-in is disabled in the demo). A reset removes every guest (their
 * boards, sessions and content cascade) and rebuilds the template from the seed in the image.
 */

const DEMO_DOMAIN = '@demo.invalid'
const TEMPLATE_EMAIL = `template${DEMO_DOMAIN}`
const GUEST_PATTERN = `guest-%${DEMO_DOMAIN}`
const TEMPLATE_PATTERN = `template%${DEMO_DOMAIN}`
/** Serialises template swaps (pg advisory lock key, arbitrary but fixed). */
const RESET_LOCK = 7_406_221

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const randomPassword = () => randomBytes(24).toString('base64url')

function firstRow<T>(result: { rows: unknown[] }): T {
  return result.rows[0] as T
}

/** The template board's id, or null while none exists (first start, or mid-rebuild on a new DB). */
export async function templateBoardId(db: Database): Promise<string | null> {
  const rows = await db
    .select({ id: boards.id })
    .from(boards)
    .innerJoin(user, eq(user.id, boards.ownerId))
    .where(eq(user.email, TEMPLATE_EMAIL))
    .limit(1)
  return rows[0]?.id ?? null
}

export interface BoardCounts {
  entries: number
  connections: number
  strokes: number
  frames: number
  teleports: number
  tags: number
}

/** Rows per content table on one board (soft-deleted entries included: they still take space). */
export async function boardCounts(db: Database, boardId: string): Promise<BoardCounts> {
  return firstRow<BoardCounts>(
    await db.execute(sql`select
      (select count(*) from entries where board_id = ${boardId})::int as entries,
      (select count(*) from connections where board_id = ${boardId})::int as connections,
      (select count(*) from strokes where board_id = ${boardId})::int as strokes,
      (select count(*) from frames where board_id = ${boardId})::int as frames,
      (select count(*) from teleports where board_id = ${boardId})::int as teleports,
      (select count(*) from tags where board_id = ${boardId})::int as tags`),
  )
}

/** Every object on `boardId` if `ownerId` owns it, otherwise null (the route answers 404 itself). */
export async function ownedObjectCount(
  db: Database,
  boardId: string,
  ownerId: string,
): Promise<number | null> {
  if (!UUID.test(boardId)) {
    return null
  }
  const row = firstRow<{ owned: boolean; objects: number }>(
    await db.execute(sql`select
      exists (select 1 from boards where id = ${boardId} and owner_id = ${ownerId}) as owned,
      (select count(*) from entries where board_id = ${boardId})
      + (select count(*) from connections where board_id = ${boardId})
      + (select count(*) from strokes where board_id = ${boardId})
      + (select count(*) from frames where board_id = ${boardId})
      + (select count(*) from teleports where board_id = ${boardId})
      + (select count(*) from tags where board_id = ${boardId}) as objects`),
  )
  return row.owned ? Number(row.objects) : null
}

export interface DemoCounts extends BoardCounts {
  users: number
  guests: number
  boards: number
  sessions: number
  entryVersions: number
  assets: number
}

/** Instance-wide row counts — what a reset must bring back exactly. */
export async function demoCounts(db: Database): Promise<DemoCounts> {
  return firstRow<DemoCounts>(
    await db.execute(sql`select
      (select count(*) from "user")::int as users,
      (select count(*) from "user" where email like ${GUEST_PATTERN})::int as guests,
      (select count(*) from boards)::int as boards,
      (select count(*) from session)::int as sessions,
      (select count(*) from entries)::int as entries,
      (select count(*) from entry_versions)::int as "entryVersions",
      (select count(*) from connections)::int as connections,
      (select count(*) from strokes)::int as strokes,
      (select count(*) from frames)::int as frames,
      (select count(*) from teleports)::int as teleports,
      (select count(*) from tags)::int as tags,
      (select count(*) from assets)::int as assets`),
  )
}

export async function guestCount(db: Database): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(user)
    .where(like(user.email, GUEST_PATTERN))
  return rows[0]?.n ?? 0
}

/** Size of the current database in bytes (the demo refuses writes above DEMO_MAX_DB_MB). */
export async function databaseBytes(db: Database): Promise<number> {
  const row = firstRow<{ bytes: string }>(
    await db.execute(sql`select pg_database_size(current_database())::text as bytes`),
  )
  return Number(row.bytes)
}

/**
 * Copy the content of `fromBoardId` onto `toBoardId` with fresh ids: entries, threads, strokes,
 * frames, teleports, tags and tag assignments, plus the board's name and appearance. Versions and
 * images are not copied (the demo has no uploads). One repeatable-read transaction, so a reset
 * running at the same moment can never leave a half copy.
 */
export async function copyBoardContent(
  db: Database,
  fromBoardId: string,
  toBoardId: string,
  userId: string,
): Promise<void> {
  await db.transaction(
    async (tx) => {
      await tx.execute(sql`create temp table demo_entry_map on commit drop as
        select id as old_id, gen_random_uuid() as new_id
        from entries where board_id = ${fromBoardId} and deleted_at is null`)
      await tx.execute(sql`create temp table demo_tag_map on commit drop as
        select id as old_id, gen_random_uuid() as new_id from tags where board_id = ${fromBoardId}`)
      await tx.execute(sql`insert into entries (id, type, x, y, width, height, rotation, z_index,
          visibility, color, content, board_id, search_text, created_by, updated_by)
        select m.new_id, e.type, e.x, e.y, e.width, e.height, e.rotation, e.z_index, e.visibility,
          e.color, e.content, ${toBoardId}, e.search_text, ${userId}, ${userId}
        from entries e join demo_entry_map m on m.old_id = e.id`)
      await tx.execute(sql`insert into connections (board_id, from_entry_id, to_entry_id, color,
          label, arrow_start, arrow_end, curve_style, created_by)
        select ${toBoardId}, f.new_id, t.new_id, c.color, c.label, c.arrow_start, c.arrow_end,
          c.curve_style, ${userId}
        from connections c
        join demo_entry_map f on f.old_id = c.from_entry_id
        join demo_entry_map t on t.old_id = c.to_entry_id
        where c.board_id = ${fromBoardId}`)
      await tx.execute(sql`insert into strokes (entry_id, board_id, points, color, size, tool,
          min_x, min_y, max_x, max_y, created_by)
        select m.new_id, ${toBoardId}, s.points, s.color, s.size, s.tool, s.min_x, s.min_y,
          s.max_x, s.max_y, ${userId}
        from strokes s left join demo_entry_map m on m.old_id = s.entry_id
        where s.board_id = ${fromBoardId} and (s.entry_id is null or m.new_id is not null)`)
      await tx.execute(sql`insert into frames (board_id, name, x, y, width, height, color)
        select ${toBoardId}, name, x, y, width, height, color
        from frames where board_id = ${fromBoardId}`)
      await tx.execute(sql`insert into teleports (board_id, name, x, y, zoom, is_board_button,
          board_x, board_y, icon, color)
        select ${toBoardId}, name, x, y, zoom, is_board_button, board_x, board_y, icon, color
        from teleports where board_id = ${fromBoardId}`)
      await tx.execute(sql`insert into tags (id, board_id, name, color, style_rules)
        select m.new_id, ${toBoardId}, t.name, t.color, t.style_rules
        from tags t join demo_tag_map m on m.old_id = t.id`)
      await tx.execute(sql`insert into entry_tags (entry_id, tag_id)
        select e.new_id, t.new_id from entry_tags et
        join demo_entry_map e on e.old_id = et.entry_id
        join demo_tag_map t on t.old_id = et.tag_id`)
      await tx.execute(sql`update boards set
          name = src.name, settings = src.settings, updated_at = now()
        from boards src where src.id = ${fromBoardId} and boards.id = ${toBoardId}`)
    },
    { isolationLevel: 'repeatable read' },
  )
}

/** Create a guest account whose board is a copy of the template. Returns its sign-in details. */
export async function createGuest(
  db: Database,
  fromBoardId: string,
): Promise<{ email: string; password: string }> {
  const email = `guest-${randomUUID()}${DEMO_DOMAIN}`
  const password = randomPassword()
  const created = await createUserWithPassword(db, {
    email,
    password,
    name: 'Guest',
    role: 'user',
  })
  if (!created) {
    throw new Error('guest account collision')
  }
  await copyBoardContent(db, fromBoardId, created.boardId, created.id)
  return { email, password }
}

/**
 * Build a new template account and fill its board with the seed through the real routes,
 * in-process (no network, no running server needed). The demo guard is not mounted on this app.
 */
async function buildTemplate(db: Database, env: Env, auth: Auth): Promise<string> {
  const email = `template-next-${randomUUID()}${DEMO_DOMAIN}`
  const password = randomPassword()
  const created = await createUserWithPassword(db, {
    email,
    password,
    name: 'Demo',
    role: 'user',
  })
  if (!created) {
    throw new Error('template account collision')
  }
  const app = buildApp({ db, env: { ...env, DEMO_MODE: 'off' }, auth })
  const origin = new URL(env.BETTER_AUTH_URL).origin
  const signIn = await app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email, password }),
  })
  if (!signIn.ok) {
    throw new Error(`template sign-in failed: ${signIn.status}`)
  }
  const cookie = signIn.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const call: ApiCall = async (method, path, body) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', origin, cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!res.ok) {
      throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`)
    }
    const text = await res.text()
    return text ? (JSON.parse(text) as Json) : {}
  }
  await seedDemoBoard(call, created.boardId)
  await db.update(boards).set({ name: 'Demo board' }).where(eq(boards.id, created.boardId))
  // The seeding session is not a visitor; drop it so a reset leaves no session behind.
  await db.delete(session).where(eq(session.userId, created.id))
  return created.id
}

/** Make `templateId` the one template; with `removeGuests`, delete every guest. Atomic. */
async function promoteTemplate(
  db: Database,
  templateId: string,
  removeGuests: boolean,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${RESET_LOCK})`)
    if (removeGuests) {
      await tx.delete(user).where(like(user.email, GUEST_PATTERN))
    }
    await tx.delete(user).where(and(like(user.email, TEMPLATE_PATTERN), ne(user.id, templateId)))
    await tx.update(user).set({ email: TEMPLATE_EMAIL }).where(eq(user.id, templateId))
  })
}

/**
 * The hourly reset: rebuild the template from the seed, then in one transaction delete every guest
 * and swap the template in. Visitors keep using the site throughout; a guest whose account is gone
 * gets a fresh copy on the next page load.
 */
export async function resetDemo(
  db: Database,
  env: Env,
  auth: Auth,
): Promise<{ guestsRemoved: number; ms: number }> {
  const started = Date.now()
  const guestsRemoved = await guestCount(db)
  const templateId = await buildTemplate(db, env, auth)
  await promoteTemplate(db, templateId, true)
  return { guestsRemoved, ms: Date.now() - started }
}

/** On api start: build the template if there is none yet (keeps existing guests). */
export async function ensureDemoTemplate(db: Database, env: Env, auth: Auth): Promise<void> {
  if (await templateBoardId(db)) {
    return
  }
  const templateId = await buildTemplate(db, env, auth)
  await promoteTemplate(db, templateId, false)
}
