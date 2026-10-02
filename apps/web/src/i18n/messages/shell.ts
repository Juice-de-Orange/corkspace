import type { Catalog } from './types'

/** App header / shell / nav / public-board chrome. Key prefix: `shell.*`. */
export const shell = {
  'shell.brand': { de: 'Corkspace', en: 'Corkspace' },
  'shell.share': { de: 'Teilen', en: 'Share' },
  'shell.account': { de: 'Konto', en: 'Account' },
  'shell.admin': { de: 'Admin', en: 'Admin' },
  'shell.signOut': { de: 'Abmelden', en: 'Sign out' },
  'shell.pickBoard': { de: 'Board wählen', en: 'Choose board' },
  'shell.board': { de: 'Board', en: 'Board' },
  'shell.menu': { de: 'Menü', en: 'Menu' },
  'shell.boardNotFound': { de: 'Board nicht gefunden.', en: 'Board not found.' },
  'shell.themeToggle': { de: 'Design wechseln', en: 'Switch theme' },
  'shell.readOnly': { de: 'Nur-Lese-Ansicht', en: 'Read-only view' },
  'shell.linkInvalid': {
    de: 'Dieser Link ist ungültig oder wurde widerrufen.',
    en: 'This link is invalid or has been revoked.',
  },
} satisfies Catalog
