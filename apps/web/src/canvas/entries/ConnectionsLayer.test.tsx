import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { boardAccessAtom } from '../state/board-store'
import { connectionsAtom } from '../state/connection-store'
import { type EntryMeta, entriesAtom } from '../state/entry-store'
import { ConnectionsLayer } from './ConnectionsLayer'

const a: EntryMeta = {
  id: 'a',
  type: 'sticky',
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  rotation: 0,
  zIndex: 1,
  visibility: 'private',
}
const b: EntryMeta = { ...a, id: 'b', x: 400 }

afterEach(() => {
  connectionsAtom.set(new Map())
  entriesAtom.set(new Map())
  boardAccessAtom.set(null)
})

describe('ConnectionsLayer', () => {
  it('renders a thread with zoom-true CSS classes and NO vector-effect anywhere', () => {
    entriesAtom.set(
      new Map([
        [a.id, a],
        [b.id, b],
      ]),
    )
    connectionsAtom.set(
      new Map([
        [
          'c1',
          {
            id: 'c1',
            fromEntryId: 'a',
            toEntryId: 'b',
            color: '#dc2626',
            label: 'mag',
            arrowStart: false,
            arrowEnd: true,
          },
        ],
      ]),
    )
    boardAccessAtom.set({
      level: 'owner',
      canEdit: true,
      canSeePrivate: true,
      canSeeFurniture: true,
      isSuperAdmin: false,
    })
    const { container } = render(<ConnectionsLayer />)

    // Current Chromium refuses to paint non-scaling-stroke paths in these overlays — the
    // attribute is banned; widths come from the --px CSS classes instead.
    expect(container.querySelectorAll('[vector-effect]')).toHaveLength(0)

    const line = container.querySelector('.conn-line')
    expect(line?.getAttribute('stroke')).toBe('#dc2626')
    expect(line?.getAttribute('marker-end')).toBe('url(#conn-arrow)')
    // Wool-yarn passes: shadow under the coloured core, twist glints on top, one of each.
    expect(container.querySelectorAll('.conn-shadow')).toHaveLength(1)
    expect(container.querySelectorAll('.conn-twist')).toHaveLength(1)
    expect(container.querySelector('.conn-shadow')?.getAttribute('d')).toBe(line?.getAttribute('d'))
    expect(container.querySelector('.conn-hit')).not.toBeNull()
    expect(container.querySelector('.conn-label')?.textContent).toBe('mag')
  })
})
