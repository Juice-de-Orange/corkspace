import type { Catalog } from './types'

/** Admin dashboard (AdminDashboard.tsx). Key prefix: `admin.*`. */
export const admin = {
  // Page chrome + access gate.
  'admin.title': { de: 'Verwaltung', en: 'Administration' },
  'admin.noAccess': { de: 'Kein Zugriff.', en: 'No access.' },
  'admin.toBoard': { de: 'Zum Board', en: 'To board' },
  'admin.backToBoard': { de: '← Zum Board', en: '← To board' },

  // Tab labels.
  'admin.tabUsers': { de: 'Benutzer', en: 'Users' },
  'admin.tabBoards': { de: 'Boards', en: 'Boards' },
  'admin.tabFeedback': { de: 'Feedback', en: 'Feedback' },
  'admin.tabDefaults': { de: 'Standards', en: 'Defaults' },
  'admin.tabStats': { de: 'Statistik', en: 'Statistics' },

  // Users tab — create form + table.
  'admin.createUser': { de: 'Benutzer anlegen', en: 'Create user' },
  'admin.name': { de: 'Name', en: 'Name' },
  'admin.email': { de: 'E-Mail', en: 'Email' },
  'admin.password': { de: 'Passwort', en: 'Password' },
  'admin.passwordHint': { de: 'mindestens 8 Zeichen', en: 'at least 8 characters' },
  'admin.role': { de: 'Rolle', en: 'Role' },
  'admin.newUserRoleAria': { de: 'Rolle des neuen Benutzers', en: 'Role of the new user' },
  'admin.roleUser': { de: 'Benutzer', en: 'User' },
  'admin.roleAdmin': { de: 'Admin', en: 'Admin' },
  'admin.create': { de: 'Anlegen', en: 'Create' },
  'admin.emailExists': { de: 'E-Mail existiert bereits.', en: 'Email already exists.' },
  'admin.createFailed': { de: 'Anlegen fehlgeschlagen.', en: 'Creation failed.' },
  'admin.actions': { de: 'Aktionen', en: 'Actions' },
  'admin.you': { de: 'du', en: 'you' },
  'admin.manage': { de: 'Verwalten', en: 'Manage' },

  // Manage-user modal.
  'admin.manageUser': {
    de: 'Benutzer verwalten — {email}',
    en: 'Manage user — {email}',
  },
  'admin.saved': { de: 'Gespeichert', en: 'Saved' },
  'admin.lastAdminDemote': {
    de: 'Der letzte Admin kann nicht zurückgestuft werden.',
    en: 'The last admin cannot be demoted.',
  },
  'admin.saveFailed': { de: 'Speichern fehlgeschlagen.', en: 'Saving failed.' },
  'admin.userDeleted': { de: 'Benutzer gelöscht', en: 'User deleted' },
  'admin.cannotDeleteSelf': {
    de: 'Du kannst dich nicht selbst löschen.',
    en: 'You cannot delete yourself.',
  },
  'admin.lastAdminDelete': {
    de: 'Der letzte Admin kann nicht gelöscht werden.',
    en: 'The last admin cannot be deleted.',
  },
  'admin.deleteFailed': { de: 'Löschen fehlgeschlagen.', en: 'Deletion failed.' },
  'admin.onlyAdminHint': {
    de: 'Der einzige Admin — Rolle kann nicht entzogen und das Konto nicht gelöscht werden.',
    en: 'The only admin — the role cannot be removed and the account cannot be deleted.',
  },
  'admin.newPassword': { de: 'Neues Passwort', en: 'New password' },
  'admin.newPasswordHint': {
    de: 'leer lassen = unverändert; sonst mindestens 8 Zeichen',
    en: 'leave empty = unchanged; otherwise at least 8 characters',
  },
  'admin.cannotDeleteSelfTitle': {
    de: 'Du kannst dich nicht selbst löschen',
    en: 'You cannot delete yourself',
  },
  'admin.lastAdmin': { de: 'Letzter Admin', en: 'Last admin' },

  // Boards tab.
  'admin.allBoards': { de: 'Alle Boards', en: 'All boards' },
  'admin.board': { de: 'Board', en: 'Board' },
  'admin.owner': { de: 'Besitzer', en: 'Owner' },

  // Feedback tab.
  'admin.screenshotLoadFailed': {
    de: 'Screenshot konnte nicht geladen werden.',
    en: 'Screenshot could not be loaded.',
  },
  'admin.kind': { de: 'Art', en: 'Kind' },
  'admin.allKinds': { de: 'Alle Arten', en: 'All kinds' },
  'admin.bug': { de: 'Fehler', en: 'Bug' },
  'admin.wish': { de: 'Wunsch', en: 'Wish' },
  'admin.status': { de: 'Status', en: 'Status' },
  'admin.statusOpen': { de: 'Offen', en: 'Open' },
  'admin.statusDone': { de: 'Erledigt', en: 'Done' },
  'admin.all': { de: 'Alle', en: 'All' },
  'admin.noFeedback': { de: 'Kein Feedback.', en: 'No feedback.' },
  'admin.showScreenshot': { de: 'Screenshot anzeigen', en: 'Show screenshot' },
  'admin.markOpen': { de: 'Als offen markieren', en: 'Mark as open' },
  'admin.markDone': { de: 'Als erledigt markieren', en: 'Mark as done' },
  'admin.deleteFeedback': { de: 'Feedback löschen', en: 'Delete feedback' },
  'admin.feedbackScreenshotAlt': { de: 'Feedback-Screenshot', en: 'Feedback screenshot' },

  // Defaults tab.
  'admin.globalDefaults': { de: 'Globale Standards', en: 'Global defaults' },
  'admin.defaultsHint': {
    de: 'Diese Werte gelten als Standard für alle Boards, solange ein Board sie nicht überschreibt.',
    en: 'These values act as the default for all boards, as long as a board does not override them.',
  },
  'admin.background': { de: 'Hintergrund', en: 'Background' },
  'admin.fontSize': { de: 'Schriftgröße {k}', en: 'Font size {k}' },
  'admin.fontFamily': { de: 'Schriftart {k}', en: 'Font family {k}' },

  // Stats tab.
  'admin.statsLoadFailed': {
    de: 'Statistiken konnten nicht geladen werden.',
    en: 'Statistics could not be loaded.',
  },
  'admin.openFeedback': { de: 'Offenes Feedback', en: 'Open feedback' },
} satisfies Catalog
