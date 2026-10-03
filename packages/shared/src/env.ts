/// <reference types="node" />
// Server-side env parsing reads process.env; the web app type-checks this file through its imports
// of @corkspace/shared and must not depend on a test runner to bring the node types along.
import { z } from 'zod'

/**
 * Runtime environment schema. Validated once at every server entrypoint
 * (api, worker, migrate). SMTP is optional.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().url(),

  BETTER_AUTH_SECRET: z.string().min(16, 'BETTER_AUTH_SECRET must be at least 16 chars'),
  BETTER_AUTH_URL: z.string().url(),
  AUTH_TRUSTED_ORIGINS: z.string().default(''),

  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 chars'),
  ADMIN_NAME: z.string().default('Admin'),

  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().optional(),
  ASSET_DIR: z.string().default('./.assets'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

/** Parse + validate environment, throwing a readable aggregate error on failure. */
export function parseEnv(raw: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment:\n${issues}`)
  }
  return parsed.data
}

/** Split a comma/space-separated origins string into a clean list. */
export function parseTrustedOrigins(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
