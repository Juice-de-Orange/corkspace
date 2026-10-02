import { describe, expect, it } from 'vitest'
import { createFeedbackSchema, patchFeedbackSchema } from './feedback-dto'

describe('createFeedbackSchema', () => {
  it('accepts a minimal bug report', () => {
    expect(createFeedbackSchema.safeParse({ kind: 'bug', message: 'kaputt' }).success).toBe(true)
  })

  it('accepts a wish with context + screenshot data URL', () => {
    const r = createFeedbackSchema.safeParse({
      kind: 'wish',
      message: 'mehr Farben',
      context: 'https://app.example.com/',
      screenshot: 'data:image/jpeg;base64,/9j/AAA',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an invalid kind', () => {
    expect(createFeedbackSchema.safeParse({ kind: 'other', message: 'x' }).success).toBe(false)
  })

  it('rejects an empty message', () => {
    expect(createFeedbackSchema.safeParse({ kind: 'bug', message: '   ' }).success).toBe(false)
  })

  it('rejects a non-image-data-url screenshot', () => {
    expect(
      createFeedbackSchema.safeParse({ kind: 'bug', message: 'x', screenshot: 'http://evil/x.png' })
        .success,
    ).toBe(false)
  })

  it('rejects unknown fields', () => {
    expect(createFeedbackSchema.safeParse({ kind: 'bug', message: 'x', evil: 1 }).success).toBe(
      false,
    )
  })
})

describe('patchFeedbackSchema', () => {
  it('accepts open/done', () => {
    expect(patchFeedbackSchema.safeParse({ status: 'done' }).success).toBe(true)
    expect(patchFeedbackSchema.safeParse({ status: 'open' }).success).toBe(true)
  })
  it('rejects other statuses', () => {
    expect(patchFeedbackSchema.safeParse({ status: 'wip' }).success).toBe(false)
  })
})
