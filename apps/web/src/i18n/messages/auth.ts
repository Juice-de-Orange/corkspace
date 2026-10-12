import type { Catalog } from './types'

/** Login / auth screens (`auth.*`) and the public demo (`demo.*`). */
export const auth = {
  'auth.subtitle': { de: 'Bitte anmelden', en: 'Please sign in' },
  'auth.email': { de: 'E-Mail', en: 'Email' },
  'auth.password': { de: 'Passwort', en: 'Password' },
  'auth.signIn': { de: 'Anmelden', en: 'Sign in' },
  'auth.signingIn': { de: 'Anmelden…', en: 'Signing in…' },
  'auth.failed': { de: 'Anmeldung fehlgeschlagen', en: 'Sign-in failed' },
  'demo.banner': {
    de: 'Demo — die Daten werden jede Stunde zurückgesetzt. Bitte keine persönlichen Daten eingeben.',
    en: 'Demo — data resets every hour. Do not enter personal data.',
  },
  'demo.starting': {
    de: 'Dein eigenes Demo-Board wird vorbereitet…',
    en: 'Preparing your own demo board…',
  },
  'demo.start': { de: 'Demo starten', en: 'Start the demo' },
  'demo.busy': {
    de: 'Die Demo ist gerade ausgelastet. Bitte versuche es in ein paar Minuten noch einmal.',
    en: 'The demo is busy right now. Please try again in a few minutes.',
  },
} satisfies Catalog
