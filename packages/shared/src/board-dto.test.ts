import { describe, expect, it } from 'vitest'
import {
  createShareSchema,
  inviteMemberSchema,
  patchBoardSchema,
  patchMemberSchema,
} from './board-dto'

describe('inviteMemberSchema', () => {
  it('accepts an editor/viewer invite and defaults showFurniture=true', () => {
    const p = inviteMemberSchema.safeParse({ email: 'a@b.io', role: 'editor' })
    expect(p.success).toBe(true)
    if (p.success) {
      expect(p.data.showFurniture).toBe(true)
    }
  })
  it('rejects a bad email or unknown role', () => {
    expect(inviteMemberSchema.safeParse({ email: 'nope', role: 'editor' }).success).toBe(false)
    expect(inviteMemberSchema.safeParse({ email: 'a@b.io', role: 'owner' }).success).toBe(false)
  })
})

describe('patchMemberSchema', () => {
  it('accepts partial updates and rejects unknown keys', () => {
    expect(patchMemberSchema.safeParse({ role: 'viewer' }).success).toBe(true)
    expect(patchMemberSchema.safeParse({ showFurniture: false }).success).toBe(true)
    expect(patchMemberSchema.safeParse({ nope: 1 }).success).toBe(false)
  })
})

describe('createShareSchema', () => {
  it('defaults showFurniture and allows an optional label', () => {
    const p = createShareSchema.safeParse({ label: 'for grandma' })
    expect(p.success).toBe(true)
    if (p.success) {
      expect(p.data.showFurniture).toBe(true)
    }
  })
})

describe('patchBoardSchema', () => {
  it('accepts a name and/or sparse settings', () => {
    expect(patchBoardSchema.safeParse({ name: 'Neu' }).success).toBe(true)
    expect(patchBoardSchema.safeParse({ settings: { background: 'paper' } }).success).toBe(true)
    expect(patchBoardSchema.safeParse({ settings: { background: 'neon' } }).success).toBe(false)
  })
  it('rejects an empty name', () => {
    expect(patchBoardSchema.safeParse({ name: '' }).success).toBe(false)
  })
})
