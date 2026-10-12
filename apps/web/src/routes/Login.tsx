import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useValue } from 'signia-react'
import { Field } from '../components/ui'
import { useT } from '../i18n'
import { signIn } from '../lib/auth-client'
import { brandAtom, demoAtom } from '../lib/brand'

/** Ask the server for a guest session with a private copy of the demo board. */
async function startDemoSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/demo/session', { method: 'POST', credentials: 'include' })
    return res.ok
  } catch {
    return false
  }
}

/** The sign-in page of a public demo: no form, the visitor's own board is prepared right away. */
function DemoStart() {
  const t = useT()
  const brand = useValue(brandAtom)
  const [failed, setFailed] = useState(false)
  const start = useCallback(async () => {
    setFailed(false)
    if (await startDemoSession()) {
      window.location.assign('/')
      return
    }
    setFailed(true)
  }, [])
  useEffect(() => {
    void start()
  }, [start])

  return (
    <div className="page" style={{ display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, margin: 'var(--space-4)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">
            📌
          </div>
          <h1
            className="page-title"
            style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-2xl)' }}
          >
            {brand}
          </h1>
          {failed ? (
            <>
              <p role="alert" className="field-error" style={{ marginTop: 'var(--space-3)' }}>
                {t('demo.busy')}
              </p>
              <button
                type="button"
                className="btn btn-accent btn-lg btn-block"
                style={{ marginTop: 'var(--space-5)' }}
                onClick={() => void start()}
              >
                {t('demo.start')}
              </button>
            </>
          ) : (
            <p className="hint" style={{ marginTop: 'var(--space-1)' }}>
              {t('demo.starting')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function Login() {
  const demo = useValue(demoAtom)
  return demo ? <DemoStart /> : <SignInForm />
}

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const t = useT()
  const brand = useValue(brandAtom)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn.email({ email, password })
    setLoading(false)
    if (res.error) {
      setError(res.error.message ?? t('auth.failed'))
      return
    }
    // A full navigation, not navigate('/'): a visitor who arrived via the redirect from `/`
    // still has "no session" in the client-side session store, so the protected route bounced
    // them straight back to an empty login form before the session refetch landed.
    window.location.assign('/')
  }

  return (
    <div className="page" style={{ display: 'grid', placeItems: 'center' }}>
      <form
        onSubmit={onSubmit}
        className="card"
        style={{ width: '100%', maxWidth: 400, margin: 'var(--space-4)' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">
            📌
          </div>
          <h1
            className="page-title"
            style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-2xl)' }}
          >
            {brand}
          </h1>
          <p className="hint" style={{ marginTop: 'var(--space-1)' }}>
            {t('auth.subtitle')}
          </p>
        </div>

        <Field label={t('auth.email')}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>

        <Field label={t('auth.password')}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        {error ? (
          <p role="alert" className="field-error" style={{ marginTop: 'var(--space-3)' }}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-accent btn-lg btn-block"
          style={{ marginTop: 'var(--space-5)' }}
        >
          {loading ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </div>
  )
}
