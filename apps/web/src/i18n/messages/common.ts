import type { Catalog } from './types'

/** Shared strings reused across surfaces (dialog buttons, loading, the language toggle). Area-specific
 *  strings live in their own namespace file. */
export const common = {
  'common.ok': { de: 'OK', en: 'OK' },
  'common.cancel': { de: 'Abbrechen', en: 'Cancel' },
  'common.close': { de: 'Schließen', en: 'Close' },
  'common.save': { de: 'Speichern', en: 'Save' },
  'common.delete': { de: 'Löschen', en: 'Delete' },
  'common.loading': { de: 'Lädt…', en: 'Loading…' },
  'common.back': { de: '← Zurück', en: '← Back' },
  'lang.switch': { de: 'Sprache wechseln', en: 'Switch language' },
} satisfies Catalog
