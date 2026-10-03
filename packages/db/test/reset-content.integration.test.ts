import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetContent } from '../src/reset-content'
import { startTestDb, type TestDb } from '../src/testing/postgres'

/** Content tables that a reset must EMPTY. */
const CONTENT = [
  'entries',
  'entry_versions',
  'entry_tags',
  'strokes',
  'connections',
  'frames',
  'teleports',
  'tags',
  'assets',
] as const

const E1 = '11111111-1111-1111-1111-111111111111'
const E2 = '22222222-2222-2222-2222-222222222222'
const TAG = '33333333-3333-3333-3333-333333333333'

async function count(pool: Pool, table: string): Promise<number> {
  const name = table === 'user' ? '"user"' : table
  const r = await pool.query<{ n: string }>(`select count(*)::text as n from ${name}`)
  return Number(r.rows[0]?.n ?? '0')
}

describe('resetContent', () => {
  let tdb: TestDb
  let pool: Pool

  beforeAll(async () => {
    tdb = await startTestDb()
    pool = new Pool({ connectionString: tdb.url })
    // Stopping the container right after pool.end() can hand 57P01 to a client that is still
    // closing; without a listener pg-pool's re-emit becomes an uncaught exception (see migrate test).
    pool.on('error', () => {})

    // Identity + tenancy (must SURVIVE the reset).
    await pool.query(
      `insert into "user"(id,name,email,role) values
        ('u1','Alex','owner@x.tld','admin'),
        ('u2','Gast','guest@x.tld','user')`,
    )
    const b = await pool.query<{ id: string }>(
      `insert into boards(owner_id,name) values('u1','My board') returning id`,
    )
    const boardId = b.rows[0]?.id as string
    // The migrations already seed the app_settings 'global' singleton — upsert-safe.
    await pool.query(
      `insert into app_settings(id,defaults) values('global','{}'::jsonb) on conflict (id) do nothing`,
    )
    await pool.query(`insert into board_members(board_id,user_id,role) values($1,'u2','viewer')`, [
      boardId,
    ])
    await pool.query(`insert into board_shares(board_id,token) values($1,'tok-abc')`, [boardId])
    await pool.query(`insert into feedback(kind,message,board_id) values('wish','hallo',$1)`, [
      boardId,
    ])

    // Content (must be DELETED).
    await pool.query(
      `insert into entries(id,type,x,y,width,height,board_id,created_by) values
        ($1,'sticky',0,0,240,240,$3,'u1'),
        ($2,'sticky',10,10,240,240,$3,'u1')`,
      [E1, E2, boardId],
    )
    await pool.query(
      `insert into strokes(entry_id,board_id,points,color,size,min_x,min_y,max_x,max_y)
        values(null,$1,'[[0,0,0.5]]'::jsonb,'#000',4,0,0,1,1)`,
      [boardId],
    )
    await pool.query(
      `insert into connections(board_id,from_entry_id,to_entry_id) values($1,$2,$3)`,
      [boardId, E1, E2],
    )
    await pool.query(
      `insert into frames(board_id,name,x,y,width,height) values($1,'F',0,0,100,100)`,
      [boardId],
    )
    await pool.query(`insert into teleports(board_id,name,x,y,zoom) values($1,'T',0,0,1)`, [
      boardId,
    ])
    await pool.query(`insert into tags(id,board_id,name,color) values($1,$2,'Tag','#f00')`, [
      TAG,
      boardId,
    ])
    await pool.query(`insert into entry_tags(entry_id,tag_id) values($1,$2)`, [E1, TAG])
    await pool.query(`insert into entry_versions(entry_id,snapshot) values($1,'{}'::jsonb)`, [E1])
    await pool.query(`insert into assets(board_id,mime) values($1,'image/webp')`, [boardId])
  })

  afterAll(async () => {
    await pool?.end()
    await tdb?.stop()
  })

  it('empties every content table but keeps account, board, settings, members, shares, feedback', async () => {
    // Sanity: content is present before the reset.
    for (const t of CONTENT) {
      expect(await count(pool, t), `${t} seeded`).toBeGreaterThan(0)
    }

    await resetContent(tdb.db)

    for (const t of CONTENT) {
      expect(await count(pool, t), `${t} cleared`).toBe(0)
    }
    // Identity + tenancy + appearance + feedback preserved.
    expect(await count(pool, 'user')).toBe(2)
    expect(await count(pool, 'boards')).toBe(1)
    expect(await count(pool, 'app_settings')).toBe(1)
    expect(await count(pool, 'board_members')).toBe(1)
    expect(await count(pool, 'board_shares')).toBe(1)
    expect(await count(pool, 'feedback')).toBe(1)
  })
})
