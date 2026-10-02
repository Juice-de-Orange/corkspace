import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer } from '@testcontainers/postgresql'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..')
const API_DIR = path.join(REPO_ROOT, 'apps', 'api')
const WORKER_DIR = path.join(REPO_ROOT, 'apps', 'worker')
const ASSET_DIR = path.join(tmpdir(), `corkspace-e2e-assets-${process.pid}`)

/**
 * Hermetic E2E orchestration:
 *  1. boot an ephemeral Postgres,
 *  2. start the real api against it (it self-migrates + self-seeds the admin in non-prod),
 *  3. run Playwright (its webServer builds + previews the SPA, proxying /api to the api),
 *  4. tear everything down.
 */

const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'admin-password-123'
const VIEWER_EMAIL = 'viewer@example.com'
const VIEWER_PASSWORD = 'viewer-password-123'
const API_PORT = 3100

async function waitForHealth(url: string, timeoutMs = 90_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await sleep(1000)
  }
  throw new Error(`timed out waiting for ${url}`)
}

/**
 * Seed a viewer account via the admin endpoint AND make them a viewer-member of the admin's board
 * (so the read-only e2e can open the admin board). Returns the admin's board id.
 */
async function seedBoards(port: number): Promise<string> {
  const base = `http://localhost:${port}`
  const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const cookie = signIn.headers.get('set-cookie')?.split(';')[0] ?? ''
  const me = (await fetch(`${base}/api/me`, { headers: { cookie } }).then((r) => r.json())) as {
    defaultBoardId: string
  }
  await fetch(`${base}/api/admin/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ email: VIEWER_EMAIL, password: VIEWER_PASSWORD, name: 'Viewer' }),
  })
  await fetch(`${base}/api/boards/${me.defaultBoardId}/members`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ email: VIEWER_EMAIL, role: 'viewer', showFurniture: true }),
  })
  return me.defaultBoardId
}

async function main(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start()
  const databaseUrl = container.getConnectionUri()

  const apiEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: 'e2e-secret-value-at-least-16-chars',
    BETTER_AUTH_URL: `http://localhost:${API_PORT}`,
    AUTH_TRUSTED_ORIGINS: `http://localhost:4173,http://localhost:${API_PORT}`,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    ADMIN_NAME: 'Admin',
    API_PORT: String(API_PORT),
    ASSET_DIR,
  }

  // Run the api as Node directly (not via the pnpm wrapper) so SIGTERM on teardown
  // reaches the app's graceful-shutdown handler and it exits cleanly.
  const api = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: API_DIR,
    env: apiEnv,
    stdio: 'inherit',
  })
  let worker: ReturnType<typeof spawn> | null = null
  let exitCode = 1
  try {
    await waitForHealth(`http://localhost:${API_PORT}/api/health`)
    // Start the worker only after the api is healthy — by then migrations are applied
    // (the api serves only after running them), so the `assets` table exists.
    worker = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: WORKER_DIR,
      env: apiEnv,
      stdio: 'inherit',
    })
    const adminBoardId = await seedBoards(API_PORT)

    exitCode = await new Promise<number>((resolve) => {
      // Forward any extra CLI args to Playwright, so a single spec / grep / --repeat-each can be run
      // in isolation (e.g. `tsx scripts/e2e.ts editor.spec.ts --repeat-each=5`) for de-flaking.
      const pwArgs = process.argv.slice(2)
      const pw = spawn('pnpm', ['exec', 'playwright', 'test', ...pwArgs], {
        env: {
          ...process.env,
          VITE_API_PROXY: `http://localhost:${API_PORT}`,
          E2E_ADMIN_EMAIL: ADMIN_EMAIL,
          E2E_ADMIN_PASSWORD: ADMIN_PASSWORD,
          E2E_VIEWER_EMAIL: VIEWER_EMAIL,
          E2E_VIEWER_PASSWORD: VIEWER_PASSWORD,
          E2E_ADMIN_BOARD_ID: adminBoardId,
        },
        stdio: 'inherit',
        shell: true,
      })
      pw.on('exit', (code) => resolve(code ?? 1))
    })
  } finally {
    worker?.kill()
    api.kill()
    await container.stop()
  }

  process.exit(exitCode)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
