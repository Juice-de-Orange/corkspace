import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { Modal } from './Modal'

interface PromptOptions {
  title: string
  label?: string
  placeholder?: string
  defaultValue?: string
  okText?: string
  cancelText?: string
  /** Return an error string to block submission, or null to allow. */
  validate?: (value: string) => string | null
}
interface ConfirmOptions {
  title: string
  message?: string
  okText?: string
  cancelText?: string
  danger?: boolean
}
interface AlertOptions {
  title: string
  message?: string
  okText?: string
}

interface Dialogs {
  /** Resolves with the entered string, or null if cancelled. */
  prompt: (opts: PromptOptions) => Promise<string | null>
  /** Resolves true if confirmed, false if cancelled. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  /** Resolves when acknowledged. */
  alert: (opts: AlertOptions) => Promise<void>
}

type Req =
  | ({ kind: 'prompt'; resolve: (v: string | null) => void } & PromptOptions)
  | ({ kind: 'confirm'; resolve: (v: boolean) => void } & ConfirmOptions)
  | ({ kind: 'alert'; resolve: () => void } & AlertOptions)

const DialogContext = createContext<Dialogs | null>(null)

/** Themed, accessible replacements for window.prompt/confirm/alert. Mount once near the app root. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Req | null>(null)

  const close = useCallback(() => setReq(null), [])

  const api = useMemo<Dialogs>(
    () => ({
      prompt: (opts) => new Promise((resolve) => setReq({ kind: 'prompt', resolve, ...opts })),
      confirm: (opts) => new Promise((resolve) => setReq({ kind: 'confirm', resolve, ...opts })),
      alert: (opts) => new Promise((resolve) => setReq({ kind: 'alert', resolve, ...opts })),
    }),
    [],
  )

  // Dismiss (Escape / backdrop / ✕) resolves as cancel.
  const onDismiss = useCallback(() => {
    if (!req) {
      return
    }
    if (req.kind === 'prompt') {
      req.resolve(null)
    } else if (req.kind === 'confirm') {
      req.resolve(false)
    } else {
      req.resolve()
    }
    close()
  }, [req, close])

  return (
    <DialogContext.Provider value={api}>
      {children}
      {req?.kind === 'prompt' && (
        <PromptDialog
          key={`${req.title}-prompt`}
          req={req}
          onDone={(v) => {
            req.resolve(v)
            close()
          }}
          onCancel={onDismiss}
        />
      )}
      {req?.kind === 'confirm' && (
        <Modal
          open
          title={req.title}
          onClose={onDismiss}
          footer={
            <>
              <button type="button" className="btn btn-ghost btn-lg" onClick={onDismiss}>
                {req.cancelText ?? 'Abbrechen'}
              </button>
              <button
                type="button"
                className={`btn btn-lg ${req.danger ? 'btn-danger' : 'btn-accent'}`}
                onClick={() => {
                  req.resolve(true)
                  close()
                }}
              >
                {req.okText ?? 'OK'}
              </button>
            </>
          }
        >
          {req.message ? <p className="hint">{req.message}</p> : null}
        </Modal>
      )}
      {req?.kind === 'alert' && (
        <Modal
          open
          title={req.title}
          onClose={onDismiss}
          footer={
            <button
              type="button"
              className="btn btn-accent btn-lg"
              onClick={() => {
                req.resolve()
                close()
              }}
            >
              {req.okText ?? 'OK'}
            </button>
          }
        >
          {req.message ? <p className="hint">{req.message}</p> : null}
        </Modal>
      )}
    </DialogContext.Provider>
  )
}

function PromptDialog({
  req,
  onDone,
  onCancel,
}: {
  req: Extract<Req, { kind: 'prompt' }>
  onDone: (v: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(req.defaultValue ?? '')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err = req.validate?.(value) ?? null
    if (err) {
      setError(err)
      return
    }
    onDone(value)
  }

  return (
    <Modal
      open
      title={req.title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-lg" onClick={onCancel}>
            {req.cancelText ?? 'Abbrechen'}
          </button>
          <button type="submit" form="prompt-form" className="btn btn-accent btn-lg">
            {req.okText ?? 'OK'}
          </button>
        </>
      }
    >
      <form id="prompt-form" onSubmit={submit} className="field">
        {req.label ? <span className="field-label">{req.label}</span> : null}
        {/* The Modal auto-focuses its first focusable element (this input) on open. */}
        <input
          className="input"
          value={value}
          placeholder={req.placeholder}
          aria-label={req.label ?? req.title}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) {
              setError(null)
            }
          }}
        />
        {error ? <span className="field-error">{error}</span> : null}
      </form>
    </Modal>
  )
}

// No-op fallback for renders outside a <DialogProvider> (e.g. the perf/component test harness that
// mounts canvas widgets without the App shell). In the real app every route is wrapped by the
// provider, so this only guards test-time rendering — the functions are never actually invoked there.
const FALLBACK: Dialogs = {
  prompt: () => Promise.resolve(null),
  confirm: () => Promise.resolve(false),
  alert: () => Promise.resolve(),
}

/** Access the themed dialog service. Returns a no-op fallback if rendered outside a <DialogProvider>. */
export function useDialogs(): Dialogs {
  return useContext(DialogContext) ?? FALLBACK
}
