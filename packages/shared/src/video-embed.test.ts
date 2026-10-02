import { describe, expect, it } from 'vitest'
import { parseVideoEmbed } from './video-embed'

describe('parseVideoEmbed', () => {
  it('parses YouTube watch / short / embed / shorts URLs', () => {
    const cases = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ]
    for (const c of cases) {
      const v = parseVideoEmbed(c)
      expect(v?.provider, c).toBe('youtube')
      expect(v?.id, c).toBe('dQw4w9WgXcQ')
      expect(v?.embedUrl, c).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    }
  })

  it('parses Vimeo URLs', () => {
    expect(parseVideoEmbed('https://vimeo.com/76979871')).toEqual({
      provider: 'vimeo',
      id: '76979871',
      embedUrl: 'https://player.vimeo.com/video/76979871',
    })
    expect(parseVideoEmbed('https://player.vimeo.com/video/76979871')?.provider).toBe('vimeo')
    expect(parseVideoEmbed('https://vimeo.com/channels/staffpicks/76979871')?.id).toBe('76979871')
  })

  it('rejects everything else (allowlist)', () => {
    for (const c of [
      'https://evil.com/watch?v=abc',
      'https://vimeo.evil.com/123456',
      'not a url',
      'javascript:alert(1)',
      'https://youtube.com/',
      'https://dailymotion.com/video/x123',
    ]) {
      expect(parseVideoEmbed(c), c).toBeNull()
    }
  })
})
