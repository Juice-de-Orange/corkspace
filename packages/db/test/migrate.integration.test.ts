import { copyFile, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_MIGRATIONS_FOLDER, runMigrations } from '../src/migrate'

const DOWN_FOLDER = path.resolve(DEFAULT_MIGRATIONS_FOLDER, 'down')
const AUTH_TABLES = ['user', 'session', 'account', 'verification'] as const
const BOARD_TABLES = ['boards', 'board_members', 'board_shares', 'app_settings'] as const

/**
 * A pool that ignores idle-client errors. Stopping the container right after `pool.end()` can hand
 * "terminating connection due to administrator command" to a client that is still closing; pg-pool
 * re-emits it on the pool, and without a listener Node turns it into an uncaught exception.
 */
function newPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString })
  pool.on('error', () => {})
  return pool
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  const r = await pool.query<{ reg: string | null }>('select to_regclass($1) as reg', [
    `public.${name}`,
  ])
  return r.rows[0]?.reg != null
}

async function applyDownMigrations(pool: Pool): Promise<void> {
  const files = (await readdir(DOWN_FOLDER))
    .filter((f) => f.endsWith('.down.sql'))
    .sort()
    .reverse()
  for (const f of files) {
    const sql = await readFile(path.join(DOWN_FOLDER, f), 'utf8')
    await pool.query(sql)
  }
  // Reset drizzle's migration journal so the subsequent up re-applies everything.
  await pool.query('drop schema if exists drizzle cascade')
}

/**
 * Build a temp migrations folder containing only migrations with idx <= `maxIdx` (plus a matching
 * journal). Applying it, seeding, then applying the real folder lets us exercise the 0006 backfill
 * against pre-existing data — which the empty-container up→down→up test cannot cover.
 */
async function makePartialMigrations(maxIdx: number): Promise<string> {
  const journal = JSON.parse(
    await readFile(path.join(DEFAULT_MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: { idx: number; tag: string }[] }
  const kept = journal.entries.filter((e) => e.idx <= maxIdx)
  const dir = await mkdtemp(path.join(tmpdir(), 'corkspace-mig-'))
  await mkdir(path.join(dir, 'meta'), { recursive: true })
  await writeFile(
    path.join(dir, 'meta', '_journal.json'),
    JSON.stringify({ ...journal, entries: kept }),
  )
  for (const e of kept) {
    await copyFile(
      path.join(DEFAULT_MIGRATIONS_FOLDER, `${e.tag}.sql`),
      path.join(dir, `${e.tag}.sql`),
    )
  }
  return dir
}

describe('migrations (up → down → up)', () => {
  let container: StartedPostgreSqlContainer
  let url: string
  let pool: Pool

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()
    url = container.getConnectionUri()
    pool = newPool(url)
  })

  afterAll(async () => {
    await pool?.end()
    await container?.stop()
  })

  it('applies forward, creating the Better Auth + board tables', async () => {
    await runMigrations(url)
    for (const t of [...AUTH_TABLES, ...BOARD_TABLES]) {
      expect(await tableExists(pool, t), `table ${t} should exist after up`).toBe(true)
    }
  })

  it('reverses cleanly with the down migrations, then re-applies', async () => {
    await applyDownMigrations(pool)
    for (const t of [...AUTH_TABLES, ...BOARD_TABLES]) {
      expect(await tableExists(pool, t), `table ${t} should be gone after down`).toBe(false)
    }

    await runMigrations(url)
    for (const t of [...AUTH_TABLES, ...BOARD_TABLES]) {
      expect(await tableExists(pool, t), `table ${t} should exist after re-up`).toBe(true)
    }
  })

  it('exposes users.role for RBAC (default user)', async () => {
    const r = await pool.query<{ column_name: string; column_default: string }>(
      "select column_name, column_default from information_schema.columns where table_name = 'user' and column_name = 'role'",
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]?.column_default).toContain('user')
  })

  it('makes entries.board_id NOT NULL', async () => {
    const r = await pool.query<{ is_nullable: string }>(
      "select is_nullable from information_schema.columns where table_name = 'entries' and column_name = 'board_id'",
    )
    expect(r.rows[0]?.is_nullable).toBe('NO')
  })

  it('converts feedback kind/status to enums and adds the created_by FK (0007)', async () => {
    const kind = await pool.query<{ data_type: string; udt_name: string }>(
      "select data_type, udt_name from information_schema.columns where table_name = 'feedback' and column_name = 'kind'",
    )
    expect(kind.rows[0]?.data_type).toBe('USER-DEFINED')
    expect(kind.rows[0]?.udt_name).toBe('feedback_kind')
    const fk = await pool.query(
      "select 1 from information_schema.table_constraints where constraint_name = 'feedback_created_by_user_id_fk' and constraint_type = 'FOREIGN KEY'",
    )
    expect(fk.rows).toHaveLength(1)
  })
})

describe('0006 backfill (assigns existing content to the super-admin board)', () => {
  let container: StartedPostgreSqlContainer
  let url: string
  let pool: Pool

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()
    url = container.getConnectionUri()
    pool = newPool(url)
  })

  afterAll(async () => {
    await pool?.end()
    await container?.stop()
  })

  it('creates the admin board and points all pre-existing content at it', async () => {
    // 1) Apply 0000..0005 only (before the board model existed).
    const partial = await makePartialMigrations(5)
    await runMigrations(url, partial)

    // 2) Seed pre-board data: an admin, a legacy viewer, and content authored by the admin.
    await pool.query(
      `insert into "user"(id,name,email,role,created_at) values
        ('admin1','Admin','admin@x.tld','admin', now()),
        ('viewer1','Viewer','viewer@x.tld','viewer', now() + interval '1 second')`,
    )
    await pool.query(
      `insert into entries(id,type,x,y,width,height,created_by) values
        ('11111111-1111-1111-1111-111111111111','sticky',0,0,240,240,'admin1'),
        ('22222222-2222-2222-2222-222222222222','sticky',10,10,240,240,'admin1')`,
    )
    await pool.query(
      `insert into connections(from_entry_id,to_entry_id) values
        ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')`,
    )
    await pool.query(
      `insert into strokes(points,color,size,min_x,min_y,max_x,max_y)
        values('[[0,0,0.5]]'::jsonb,'#000',4,0,0,1,1)`,
    )
    await pool.query(`insert into frames(name,x,y,width,height) values('F',0,0,100,100)`)
    await pool.query(`insert into teleports(name,x,y,zoom) values('T',0,0,1)`)
    await pool.query(`insert into tags(name,color) values('Tag','#f00')`)
    await pool.query(`insert into assets(mime) values('image/webp')`)
    await pool.query(`insert into feedback(kind,message) values('wish','hi')`)

    // 3) Apply 0006 (the backfill runs against the seeded data).
    await runMigrations(url)

    // 4a) Exactly one admin-owned board named 'My board'.
    const board = await pool.query<{ id: string; name: string }>(
      `select id, name from boards where owner_id = 'admin1'`,
    )
    expect(board.rows).toHaveLength(1)
    expect(board.rows[0]?.name).toBe('My board')
    const boardId = board.rows[0]?.id

    // 4b) Every content row was assigned to that board (no NULLs remain).
    for (const t of [
      'entries',
      'strokes',
      'connections',
      'frames',
      'teleports',
      'tags',
      'assets',
    ]) {
      const r = await pool.query<{ n: string; wrong: string }>(
        `select count(*)::text as n, count(*) filter (where board_id is distinct from $1)::text as wrong from ${t}`,
        [boardId],
      )
      expect(Number(r.rows[0]?.n), `${t} has rows`).toBeGreaterThan(0)
      expect(Number(r.rows[0]?.wrong), `${t} all board_id = admin board`).toBe(0)
    }
    const fb = await pool.query<{ board_id: string | null }>(`select board_id from feedback`)
    expect(fb.rows[0]?.board_id).toBe(boardId)

    // 4c) updated_by seeded from created_by.
    const upd = await pool.query<{ updated_by: string | null }>(
      `select updated_by from entries where id = '11111111-1111-1111-1111-111111111111'`,
    )
    expect(upd.rows[0]?.updated_by).toBe('admin1')

    // 4d) Legacy viewer converted: role=user, owns a personal board, viewer-member of admin board.
    const vrole = await pool.query<{ role: string }>(`select role from "user" where id = 'viewer1'`)
    expect(vrole.rows[0]?.role).toBe('user')
    const vboard = await pool.query<{ name: string }>(
      `select name from boards where owner_id = 'viewer1'`,
    )
    expect(vboard.rows).toHaveLength(1)
    const vmember = await pool.query<{ role: string }>(
      `select role from board_members where user_id = 'viewer1' and board_id = $1`,
      [boardId],
    )
    expect(vmember.rows[0]?.role).toBe('viewer')

    // 4e) app_settings singleton exists.
    const app = await pool.query<{ id: string }>(`select id from app_settings`)
    expect(app.rows).toHaveLength(1)
    expect(app.rows[0]?.id).toBe('global')
  })

  it('0008 rewrites stored German background ids to English and leaves other settings alone', async () => {
    // A separate database in the same container: the board model must exist (0..7), but the
    // backfill test above has already migrated this container's default database to the end.
    await pool.query('create database bg_ids')
    const bgUrl = url.replace(/\/[^/?]+(\?|$)/, '/bg_ids$1')
    const bg = newPool(bgUrl)
    try {
      await runMigrations(bgUrl, await makePartialMigrations(7))
      await bg.query(
        `insert into "user"(id,name,email,role,created_at) values
          ('u1','Admin','admin@x.tld','admin', now()), ('u2','User','user@x.tld','user', now())`,
      )
      await bg.query(
        `insert into app_settings(id,defaults) values('global','{"background":"papier","font":"serif"}'::jsonb)
          on conflict (id) do update set defaults = excluded.defaults`,
      )
      await bg.query(
        `insert into boards(owner_id,name,settings) values
          ('u1','A','{"background":"kork-foto","fontSizes":{"sticky":48}}'::jsonb),
          ('u2','B','{}'::jsonb)`,
      )

      await runMigrations(bgUrl)

      const d = await bg.query<{ defaults: Record<string, unknown> }>(
        `select defaults from app_settings where id = 'global'`,
      )
      expect(d.rows[0]?.defaults).toEqual({ background: 'paper', font: 'serif' })
      const b = await bg.query<{ settings: Record<string, unknown> }>(
        `select settings from boards order by name`,
      )
      expect(b.rows.map((r) => r.settings)).toEqual([
        { background: 'cork-photo', fontSizes: { sticky: 48 } },
        {},
      ])
    } finally {
      await bg.end()
    }
  })
})
