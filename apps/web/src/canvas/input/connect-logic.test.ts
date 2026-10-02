import { describe, expect, it } from 'vitest'
import { canCreateConnection } from './connect-logic'

const UUID_A = '11111111-1111-1111-1111-111111111111'
const UUID_B = '22222222-2222-2222-2222-222222222222'
const never = (): boolean => false
const always = (): boolean => true

describe('canCreateConnection', () => {
  it('allows two distinct persisted entries that are not already linked', () => {
    expect(canCreateConnection(UUID_A, UUID_B, never)).toBe(true)
  })

  it('refuses connecting an entry to itself', () => {
    expect(canCreateConnection(UUID_A, UUID_A, never)).toBe(false)
  })

  it('refuses when either id is a temp (non-uuid) id', () => {
    expect(canCreateConnection('temp-1', UUID_B, never)).toBe(false)
    expect(canCreateConnection(UUID_A, 'temp-2', never)).toBe(false)
  })

  it('refuses when the connection already exists', () => {
    expect(canCreateConnection(UUID_A, UUID_B, always)).toBe(false)
  })
})
