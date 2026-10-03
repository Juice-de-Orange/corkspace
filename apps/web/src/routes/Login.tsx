import { type FormEvent, useState } from 'react'
import { Field } from '../components/ui'
import { useT } from '../i18n'
import { signIn } from '../lib/auth-client'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const t = useT()

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
            {t('shell.brand')}
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
