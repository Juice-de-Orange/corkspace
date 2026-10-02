import { useValue } from 'signia-react'
import { dismissToast, type ToastKind, toastsAtom } from '../../canvas/state/toast-store'
import { useT } from '../../i18n'
import { IconButton } from './IconButton'

const ICON: Record<ToastKind, string> = {
  error: '⚠️',
  info: 'ℹ️',
  success: '✓',
}
const KIND_CLASS: Record<ToastKind, string> = {
  error: 'toast-error',
  info: '',
  success: 'toast-success',
}

/**
 * Global, bottom-centre stack of transient notices (save failures, confirmations). Mounted once at
 * the app root so it works on every surface — board, login, account, admin. Screen-reader announced.
 */
export function ToastViewport() {
  const tr = useT()
  const toasts = useValue(toastsAtom)
  if (toasts.length === 0) {
    return null
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: a toast stack is a polite live region; div+role=status is intentional
    <div className="toast-viewport" role="status" aria-live="polite" data-export-ignore>
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${KIND_CLASS[t.kind]}`} data-toast>
          <span aria-hidden="true">{ICON[t.kind]}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <IconButton label={tr('common.close')} size="sm" onClick={() => dismissToast(t.id)}>
            ✕
          </IconButton>
        </div>
      ))}
    </div>
  )
}
