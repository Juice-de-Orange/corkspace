import type { Catalog } from './types'

/** Account settings, share panel, feedback. Key prefix: `forms.*`. */
export const forms = {
  // Account settings → per-board appearance
  'forms.accountTitle': { de: 'Kontoeinstellungen', en: 'Account settings' },
  'forms.accountSubtitle': { de: 'Aussehen deines Boards', en: "Your board's appearance" },
  'forms.boardAppearance': { de: 'Board-Aussehen', en: 'Board appearance' },
  'forms.appearanceIntro': {
    de: 'Diese Einstellungen gelten für dein Board — auch für alle, mit denen du es teilst. Werte ohne Anpassung nutzen die globalen Standards.',
    en: 'These settings apply to your board — including everyone you share it with. Values without a custom setting use the global defaults.',
  },
  'forms.background': { de: 'Hintergrund', en: 'Background' },
  'forms.stickyDefaultColor': { de: 'Standard-Notizfarbe', en: 'Default note color' },
  'forms.fontSizes': { de: 'Standard-Schriftgrößen', en: 'Default font sizes' },
  'forms.fonts': { de: 'Schriftarten', en: 'Fonts' },
  'forms.resetAll': { de: 'Alles auf Standard zurücksetzen', en: 'Reset everything to default' },
  'forms.resetToast': { de: 'Auf Standard zurückgesetzt', en: 'Reset to default' },
  'forms.badgeCustom': { de: 'angepasst', en: 'customized' },
  'forms.badgeDefault': { de: 'Standard', en: 'default' },

  // Share panel
  'forms.shareTitle': { de: 'Teilen', en: 'Share' },
  'forms.inviteUser': { de: 'Benutzer einladen', en: 'Invite user' },
  'forms.email': { de: 'E-Mail', en: 'Email' },
  'forms.emailPlaceholder': { de: 'name@example.com', en: 'name@example.com' },
  'forms.role': { de: 'Rolle', en: 'Role' },
  'forms.roleViewer': { de: 'Ansehen', en: 'View' },
  'forms.roleEditor': { de: 'Bearbeiten', en: 'Edit' },
  'forms.showFurniture': {
    de: 'Zeichnungen, Rahmen & Orte anzeigen',
    en: 'Show drawings, frames & places',
  },
  'forms.invite': { de: 'Einladen', en: 'Invite' },
  'forms.inviteNoUser': {
    de: 'Kein Benutzer mit dieser E-Mail (Konten legt der Admin an).',
    en: 'No user with this email (accounts are created by the admin).',
  },
  'forms.inviteFailed': { de: 'Einladung fehlgeschlagen.', en: 'Invitation failed.' },
  'forms.removeMember': { de: 'Entfernen', en: 'Remove' },
  'forms.removeMemberError': {
    de: 'Mitglied konnte nicht entfernt werden.',
    en: 'Could not remove member.',
  },
  'forms.noneInvited': { de: 'Noch niemand eingeladen.', en: 'Nobody invited yet.' },
  'forms.externalLink': {
    de: 'Externer Link (nur Öffentliches)',
    en: 'External link (public only)',
  },
  'forms.addLink': { de: '+ Link', en: '+ Link' },
  'forms.noLinks': { de: 'Keine aktiven Links.', en: 'No active links.' },
  'forms.copyLink': { de: 'Link kopieren', en: 'Copy link' },
  'forms.revokeLink': { de: 'Widerrufen', en: 'Revoke' },
  'forms.createLinkError': {
    de: 'Freigabelink konnte nicht erstellt werden.',
    en: 'Could not create share link.',
  },
  'forms.revokeError': {
    de: 'Freigabe konnte nicht widerrufen werden.',
    en: 'Could not revoke share.',
  },
  'forms.linkCopied': { de: 'Link kopiert', en: 'Link copied' },

  // Feedback button + dialog
  'forms.feedback': { de: 'Feedback', en: 'Feedback' },
  'forms.feedbackTitle': {
    de: 'Fehler melden oder Verbesserung vorschlagen',
    en: 'Report a bug or suggest an improvement',
  },
  'forms.feedbackThanks': { de: 'Danke für dein Feedback!', en: 'Thanks for your feedback!' },
  'forms.kindBug': { de: 'Fehler', en: 'Bug' },
  'forms.kindWish': { de: 'Verbesserung', en: 'Improvement' },
  'forms.placeholderBug': { de: 'Was funktioniert nicht?', en: "What isn't working?" },
  'forms.placeholderWish': { de: 'Was würdest du verbessern?', en: 'What would you improve?' },
  'forms.attachScreenshot': { de: 'Screenshot anhängen', en: 'Attach screenshot' },
  'forms.notAvailable': { de: '(nicht verfügbar)', en: '(not available)' },
  'forms.screenshotPreview': { de: 'Screenshot-Vorschau', en: 'Screenshot preview' },
  'forms.sending': { de: 'Senden…', en: 'Sending…' },
  'forms.send': { de: 'Senden', en: 'Send' },
} satisfies Catalog
