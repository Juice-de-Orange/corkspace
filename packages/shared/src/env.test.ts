import { describe, expect, it } from 'vitest'
import { parseEnv, parseTrustedOrigins } from './env'

const base: Record<string, string> = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  BETTER_AUTH_SECRET: 'a-very-long-secret-value',
  BETTER_AUTH_URL: 'http://localhost:3000',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'supersecret',
}

describe('parseEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = parseEnv(base)
    expect(env.NODE_ENV).toBe('development')
    expect(env.API_PORT).toBe(3000)
    expect(env.ADMIN_NAME).toBe('Admin')
    expect(env.AUTH_TRUSTED_ORIGINS).toBe('')
  })

  it('coerces numeric ports from strings', () => {
    const env = parseEnv({ ...base, API_PORT: '8080', SMTP_PORT: '587' })
    expect(env.API_PORT).toBe(8080)
    expect(env.SMTP_PORT).toBe(587)
  })

  it('throws a readable aggregate error when required vars are missing', () => {
    expect(() => parseEnv({})).toThrow(/Invalid environment/)
  })

  it('rejects an invalid email', () => {
    expect(() => parseEnv({ ...base, ADMIN_EMAIL: 'not-an-email' })).toThrow(/ADMIN_EMAIL/)
  })

  it('rejects a short secret', () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('keeps the demo mode off by default, with conservative limits', () => {
    const env = parseEnv(base)
    expect(env.DEMO_MODE).toBe('off')
    expect(env.DEMO_CLIENT_IP_HEADER).toBe('x-real-ip')
    expect(env.DEMO_RATE_LIMIT).toBe(240)
    expect(env.DEMO_GUESTS_PER_IP).toBe(20)
    expect(env.DEMO_MAX_GUESTS).toBe(500)
    expect(env.DEMO_MAX_OBJECTS).toBe(200)
    expect(env.DEMO_MAX_BODY_BYTES).toBe(16_384)
    expect(env.DEMO_MAX_DB_MB).toBe(1024)
  })

  it('turns the demo mode on only for "on" and lower-cases the client-IP header', () => {
    const env = parseEnv({ ...base, DEMO_MODE: 'on', DEMO_CLIENT_IP_HEADER: 'CF-Connecting-IP' })
    expect(env.DEMO_MODE).toBe('on')
    expect(env.DEMO_CLIENT_IP_HEADER).toBe('cf-connecting-ip')
    expect(() => parseEnv({ ...base, DEMO_MODE: 'true' })).toThrow(/DEMO_MODE/)
  })
})

describe('parseTrustedOrigins', () => {
  it('splits on commas and whitespace and trims', () => {
    expect(parseTrustedOrigins('http://a.com, http://b.com  http://c.com')).toEqual([
      'http://a.com',
      'http://b.com',
      'http://c.com',
    ])
  })

  it('returns an empty list for an empty string', () => {
    expect(parseTrustedOrigins('')).toEqual([])
  })
})
