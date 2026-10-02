import { describe, expect, it } from 'vitest'
import { toolCursor } from './cursors'

describe('toolCursor', () => {
  it('pen: inline SVG cursor with the ink colour embedded, tip hotspot, crosshair fallback', () => {
    const c = toolCursor('pen', false, '#dc2626')
    expect(c.startsWith('url("data:image/svg+xml,')).toBe(true)
    expect(c).toContain(encodeURIComponent('#dc2626'))
    expect(c.endsWith(' 4 28, crosshair')).toBe(true)
  })

  it('marker: tinted like the pen, eraser: fixed look with cell fallback', () => {
    expect(toolCursor('marker', false, '#16a34a')).toContain(encodeURIComponent('#16a34a'))
    const eraser = toolCursor('eraser', false, '#16a34a')
    expect(eraser.startsWith('url("data:image/svg+xml,')).toBe(true)
    expect(eraser.endsWith(' 5 27, cell')).toBe(true)
  })

  it('is stable for a repeated tool+colour (cached)', () => {
    expect(toolCursor('pen', false, '#1a1a1a')).toBe(toolCursor('pen', false, '#1a1a1a'))
  })

  it('shape tools and the connect tool fall back to crosshair; idle is grab', () => {
    expect(toolCursor('line', false, '#1a1a1a')).toBe('crosshair')
    expect(toolCursor('arrow', false, '#1a1a1a')).toBe('crosshair')
    expect(toolCursor('rect', false, '#1a1a1a')).toBe('crosshair')
    expect(toolCursor(null, true, '#1a1a1a')).toBe('crosshair')
    expect(toolCursor(null, false, '#1a1a1a')).toBe('grab')
  })
})
