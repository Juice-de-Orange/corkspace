import type { Catalog } from './types'

/** Login / auth screens. Key prefix: `auth.*`. */
export const auth = {
  'auth.subtitle': { de: 'Bitte anmelden', en: 'Please sign in' },
  'auth.email': { de: 'E-Mail', en: 'Email' },
  'auth.password': { de: 'Passwort', en: 'Password' },
  'auth.signIn': { de: 'Anmelden', en: 'Sign in' },
  'auth.signingIn': { de: 'Anmelden…', en: 'Signing in…' },
  'auth.failed': { de: 'Anmeldung fehlgeschlagen', en: 'Sign-in failed' },
} satisfies Catalog
