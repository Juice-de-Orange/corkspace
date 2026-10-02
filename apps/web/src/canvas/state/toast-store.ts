import { atom } from 'signia'

export type ToastKind = 'error' | 'info' | 'success'

export interface Toast {
  id: number
  message: string
  kind: ToastKind
}

/** Transient user-facing notices (save failures etc.). Kept tiny + auto-expiring. */
export const toastsAtom = atom<readonly Toast[]>('toasts', [])

let seq = 0
const timers = new Map<number, ReturnType<typeof setTimeout>>()

export function pushToast(message: string, kind: ToastKind = 'error'): void {
  const id = ++seq
  toastsAtom.set([...toastsAtom.value, { id, message, kind }])
  timers.set(
    id,
    setTimeout(() => dismissToast(id), 5000),
  )
}

/** Surface a save/network failure to the user (used by optimistic commands on rollback). */
export function pushError(message: string): void {
  pushToast(message, 'error')
}

/** Confirm a successful action (e.g. settings saved). */
export function pushSuccess(message: string): void {
  pushToast(message, 'success')
}

export function dismissToast(id: number): void {
  const t = timers.get(id)
  if (t) {
    clearTimeout(t)
    timers.delete(id)
  }
  toastsAtom.set(toastsAtom.value.filter((x) => x.id !== id))
}
