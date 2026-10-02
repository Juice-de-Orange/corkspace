import { beforeEach, describe, expect, it } from 'vitest'
import { toastsAtom } from '../canvas/state/toast-store'
import { saving } from './saving'

describe('saving', () => {
  beforeEach(() => toastsAtom.set([]))

  it('on failure: reverts the optimistic change, surfaces an error toast, and re-throws', async () => {
    let reverted = false
    await expect(
      saving(
        () => Promise.reject(new Error('network')),
        () => {
          reverted = true
        },
        'Speichern fehlgeschlagen.',
      ),
    ).rejects.toThrow('network')
    expect(reverted).toBe(true)
    const toasts = toastsAtom.value
    expect(toasts).toHaveLength(1)
    expect(toasts[0]?.kind).toBe('error')
    expect(toasts[0]?.message).toBe('Speichern fehlgeschlagen.')
  })

  it('on success: does not revert and shows no toast', async () => {
    let reverted = false
    await saving(
      () => Promise.resolve('ok'),
      () => {
        reverted = true
      },
    )
    expect(reverted).toBe(false)
    expect(toastsAtom.value).toHaveLength(0)
  })
})
