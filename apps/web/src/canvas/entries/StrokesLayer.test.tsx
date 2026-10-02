import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { type EntryMeta, entriesAtom } from '../state/entry-store'
import { loadStrokes } from '../state/stroke-store'
import { StrokesLayer } from './StrokesLayer'

const entry: EntryMeta = {
  id: 'e1',
  type: 'sticky',
  x: 100,
  y: 200,
  w: 240,
  h: 160,
  rotation: 33,
  zIndex: 1,
  visibility: 'private',
  color: 'yellow',
}

afterEach(() => {
  loadStrokes([])
  entriesAtom.set(new Map())
})

describe('StrokesLayer', () => {
  it('renders board strokes untransformed and entry strokes in a rotated group', () => {
    entriesAtom.set(new Map([[entry.id, entry]]))
    loadStrokes([
      {
        id: 's-board',
        entryId: null,
        points: [
          [0, 0],
          [50, 50],
        ],
        color: '#1a1a1a',
        size: 4,
        tool: 'pen',
      },
      {
        id: 's-anchored',
        entryId: entry.id,
        points: [
          [10, 10],
          [60, 40],
        ],
        color: '#dc2626',
        size: 4,
        tool: 'pen',
      },
    ])
    const { container } = render(<StrokesLayer />)
    const paths = container.querySelectorAll('.strokes-layer path')
    expect(paths).toHaveLength(2)
    const anchored = container.querySelector('g[transform]')
    expect(anchored?.getAttribute('transform')).toBe('translate(100 200) rotate(33 120 80)')
  })

  it('drops an anchored stroke whose entry is missing (hidden/trashed)', () => {
    loadStrokes([
      { id: 's1', entryId: 'gone', points: [[0, 0]], color: '#111', size: 4, tool: 'pen' },
    ])
    const { container } = render(<StrokesLayer />)
    expect(container.querySelectorAll('path')).toHaveLength(0)
  })

  it('renders shape strokes as stroked geometry, not filled outlines', () => {
    loadStrokes([
      {
        id: 's-rect',
        entryId: null,
        points: [
          [30, 60],
          [10, 20],
        ],
        color: '#2563eb',
        size: 6,
        tool: 'rect',
      },
      {
        id: 's-arrow',
        entryId: null,
        points: [
          [0, 0],
          [100, 0],
        ],
        color: '#16a34a',
        size: 4,
        tool: 'arrow',
      },
    ])
    const { container } = render(<StrokesLayer />)
    const rect = container.querySelector('path[d="M 10 20 L 30 20 L 30 60 L 10 60 Z"]')
    expect(rect?.getAttribute('fill')).toBe('none')
    expect(rect?.getAttribute('stroke')).toBe('#2563eb')
    expect(rect?.getAttribute('stroke-width')).toBe('6')
    const arrow = [...container.querySelectorAll('path')].find((p) =>
      p.getAttribute('d')?.startsWith('M 0 0 L 100 0 M '),
    )
    expect(arrow?.getAttribute('fill')).toBe('none')
  })
})
