import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { createDb, type Database } from '../client'
import { runMigrations } from '../migrate'

export interface TestDb {
  db: Database
  url: string
  container: StartedPostgreSqlContainer
  /** Stop the pool and the container. */
  stop: () => Promise<void>
}

/**
 * Boot an ephemeral Postgres (pinned `postgres:16-alpine` to match dev/prod), apply all
 * migrations, and return a connected Drizzle client. Used by every integration suite.
 */
export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start()
  const url = container.getConnectionUri()
  await runMigrations(url)
  const { db, pool } = createDb(url)
  return {
    db,
    url,
    container,
    stop: async () => {
      await pool.end()
      await container.stop()
    },
  }
}
