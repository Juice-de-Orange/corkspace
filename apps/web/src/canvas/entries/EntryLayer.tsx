import { useValue } from 'signia-react'
import { mountSetAtom } from '../runtime/canvas-runtime'
import { entriesAtom } from '../state/entry-store'
import { EntryView } from './EntryView'
import { SelectionOverlay } from './SelectionOverlay'

/** Renders only the mounted (viewport + overscan) entries. Re-renders when that membership
 *  changes or an entry's metadata changes — never on a camera move. */
export function EntryLayer() {
  const mount = useValue(mountSetAtom)
  const entries = useValue(entriesAtom)

  const views: React.ReactNode[] = []
  for (const id of mount) {
    const meta = entries.get(id)
    if (meta) {
      views.push(<EntryView key={id} meta={meta} />)
    }
  }
  return (
    <>
      {views}
      <SelectionOverlay />
    </>
  )
}
