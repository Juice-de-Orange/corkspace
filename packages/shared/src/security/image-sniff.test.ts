import { describe, expect, it } from 'vitest'
import { ALLOWED_IMAGE_MIME, sniffImageMime } from './image-sniff'

const bytes = (...n: number[]) => new Uint8Array(n)

describe('sniffImageMime', () => {
  it('detects PNG/JPEG/GIF/WEBP from magic bytes', () => {
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImageMime(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('image/gif')
    expect(sniffImageMime(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe(
      'image/webp',
    )
  })

  it('accepts an animated GIF header and lists image/gif as allowed', () => {
    // "GIF89a" — animated GIFs share this magic prefix with static ones.
    expect(sniffImageMime(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('image/gif')
    // "GIF87a" variant.
    expect(sniffImageMime(bytes(0x47, 0x49, 0x46, 0x38, 0x37, 0x61))).toBe('image/gif')
    expect(ALLOWED_IMAGE_MIME).toContain('image/gif')
  })

  it('returns null for non-images and truncated input', () => {
    expect(sniffImageMime(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull()
    expect(sniffImageMime(bytes(0x89, 0x50))).toBeNull()
    expect(sniffImageMime(bytes())).toBeNull()
    // RIFF but not WEBP
    expect(
      sniffImageMime(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20)),
    ).toBeNull()
  })
})
