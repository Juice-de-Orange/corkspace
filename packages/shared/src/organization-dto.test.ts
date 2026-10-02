import { describe, expect, it } from 'vitest'
import {
  adminCreateUserSchema,
  adminPatchUserSchema,
  createFrameSchema,
  createTagSchema,
  createTeleportSchema,
  createViewerSchema,
  resolveEntryStyle,
} from './organization-dto'

describe('organization DTOs', () => {
  it('createTagSchema trims name, defaults styleRules, rejects empty/unknown', () => {
    const r = createTagSchema.safeParse({ name: '  Wichtig ', color: '#dc2626' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.name).toBe('Wichtig')
      expect(r.data.styleRules).toEqual({})
    }
    expect(createTagSchema.safeParse({ name: '', color: '#000' }).success).toBe(false)
    expect(createTagSchema.safeParse({ name: 'x', color: '#000', extra: 1 }).success).toBe(false)
  })

  it('frame requires positive dimensions', () => {
    expect(
      createFrameSchema.safeParse({ name: 'Area', x: 0, y: 0, width: 100, height: 100 }).success,
    ).toBe(true)
    expect(
      createFrameSchema.safeParse({ name: 'Area', x: 0, y: 0, width: -1, height: 100 }).success,
    ).toBe(false)
  })

  it('teleport requires a positive zoom; viewer requires a valid email + password length', () => {
    expect(createTeleportSchema.safeParse({ name: 'Home', x: 0, y: 0, zoom: 1 }).success).toBe(true)
    expect(createTeleportSchema.safeParse({ name: 'Home', x: 0, y: 0, zoom: 0 }).success).toBe(
      false,
    )
    expect(
      createViewerSchema.safeParse({ email: 'v@x.io', password: 'longenough', name: 'V' }).success,
    ).toBe(true)
    expect(
      createViewerSchema.safeParse({ email: 'bad', password: 'longenough', name: 'V' }).success,
    ).toBe(false)
    expect(
      createViewerSchema.safeParse({ email: 'v@x.io', password: 'short', name: 'V' }).success,
    ).toBe(false)
  })
})

describe('admin user DTOs', () => {
  it('adminPatchUserSchema accepts any single field and rejects an empty or invalid patch', () => {
    expect(adminPatchUserSchema.safeParse({ role: 'admin' }).success).toBe(true)
    expect(adminPatchUserSchema.safeParse({ name: 'Max' }).success).toBe(true)
    expect(adminPatchUserSchema.safeParse({ password: 'longenough' }).success).toBe(true)
    expect(adminPatchUserSchema.safeParse({}).success).toBe(false) // at least one field required
    expect(adminPatchUserSchema.safeParse({ role: 'root' }).success).toBe(false) // bad role
    expect(adminPatchUserSchema.safeParse({ password: 'short' }).success).toBe(false) // < 8 chars
    expect(adminPatchUserSchema.safeParse({ name: 'x', extra: 1 }).success).toBe(false) // strict
  })

  it('adminCreateUserSchema allows an optional role', () => {
    expect(
      adminCreateUserSchema.safeParse({ email: 'a@x.io', password: 'longenough', name: 'A' })
        .success,
    ).toBe(true)
    expect(
      adminCreateUserSchema.safeParse({
        email: 'a@x.io',
        password: 'longenough',
        name: 'A',
        role: 'admin',
      }).success,
    ).toBe(true)
    expect(
      adminCreateUserSchema.safeParse({
        email: 'a@x.io',
        password: 'longenough',
        name: 'A',
        role: 'nope',
      }).success,
    ).toBe(false)
  })
})

describe('resolveEntryStyle', () => {
  it('merges tag style rules, later tags winning per field', () => {
    expect(
      resolveEntryStyle([{ borderColor: 'red' }, { background: '#eee' }, { borderColor: 'blue' }]),
    ).toEqual({ borderColor: 'blue', background: '#eee' })
  })

  it('ignores null/undefined and empty rules', () => {
    expect(resolveEntryStyle([null, undefined, {}])).toEqual({})
  })
})
