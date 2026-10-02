import { describe, expect, it } from 'vitest'
import {
  createEntrySchema,
  entrySearchText,
  patchEntrySchema,
  tiptapToPlainText,
  validateContent,
} from './entry-dto'

describe('content validation', () => {
  it('accepts valid per-type content', () => {
    expect(validateContent('sticky', { text: 'hi' })).toBe(true)
    expect(validateContent('checklist', { items: [{ id: '1', text: 'a', checked: false }] })).toBe(
      true,
    )
    expect(validateContent('link', { url: 'https://example.com', title: 'X' })).toBe(true)
    expect(validateContent('doc', { doc: { type: 'doc' } })).toBe(true)
    expect(validateContent('image', { alt: 'a cat' })).toBe(true)
  })

  it('rejects invalid content', () => {
    expect(validateContent('sticky', { text: 123 })).toBe(false)
    expect(validateContent('link', { url: 'not-a-url' })).toBe(false)
  })
})

describe('createEntrySchema', () => {
  it('validates a sticky create and applies defaults', () => {
    const parsed = createEntrySchema.parse({
      type: 'sticky',
      x: 0,
      y: 0,
      width: 240,
      height: 240,
      content: { text: 'hello' },
    })
    expect(parsed.rotation).toBe(0)
    expect(parsed.visibility).toBe('private')
  })

  it('rejects a mismatched content shape and unknown fields', () => {
    expect(
      createEntrySchema.safeParse({
        type: 'link',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        content: { nope: true },
      }).success,
    ).toBe(false)
    expect(
      createEntrySchema.safeParse({
        type: 'sticky',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        content: { text: 'a' },
        evil: 1,
      }).success,
    ).toBe(false)
  })
})

describe('patchEntrySchema', () => {
  it('accepts partial fields + rev/commitVersion', () => {
    expect(patchEntrySchema.safeParse({ x: 5, rev: 3, commitVersion: true }).success).toBe(true)
    expect(patchEntrySchema.safeParse({ width: -1 }).success).toBe(false)
  })
})

describe('plain-text extraction', () => {
  it('walks a TipTap doc collecting text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'world' }] },
      ],
    }
    expect(tiptapToPlainText(doc)).toBe('Hello world')
    expect(tiptapToPlainText(null)).toBe('')
  })

  it('derives search text per entry type', () => {
    expect(entrySearchText('sticky', { text: 'note' })).toBe('note')
    expect(entrySearchText('checklist', { items: [{ text: 'buy milk' }, { text: 'call' }] })).toBe(
      'buy milk call',
    )
    expect(entrySearchText('link', { url: 'https://x.io', title: 'Title' })).toContain('Title')
    expect(entrySearchText('image', { alt: 'cat' })).toBe('cat')
    expect(entrySearchText('doc', { doc: { content: [{ type: 'text', text: 'body' }] } })).toBe(
      'body',
    )
  })
})
