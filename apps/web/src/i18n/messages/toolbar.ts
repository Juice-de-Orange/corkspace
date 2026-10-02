import type { Catalog } from './types'

/** Create/draw toolbar (CreateToolbar.tsx). Key prefix: `toolbar.*`. */
export const toolbar = {
  // Create-button labels (also composed into their "+ …" aria-labels).
  'toolbar.note': { de: 'Notiz', en: 'Note' },
  'toolbar.doc': { de: 'Dok', en: 'Doc' },
  'toolbar.list': { de: 'Liste', en: 'List' },
  'toolbar.image': { de: 'Bild', en: 'Image' },
  'toolbar.link': { de: 'Link', en: 'Link' },
  'toolbar.video': { de: 'Video', en: 'Video' },
  'toolbar.frame': { de: 'Rahmen', en: 'Frame' },

  // Document creation extras.
  'toolbar.docTitle': {
    de: 'Leeres Dokument (Pfeil: liniert / kariert)',
    en: 'Blank document (arrow: lined / grid)',
  },
  'toolbar.paperType': { de: 'Papierart wählen', en: 'Choose paper type' },
  'toolbar.paperBlank': { de: 'Leer', en: 'Blank' },
  'toolbar.paperLined': { de: 'Liniert', en: 'Lined' },
  'toolbar.paperGrid': { de: 'Kariert', en: 'Grid' },

  // Video button hint.
  'toolbar.videoTitle': {
    de: 'Nur YouTube und Vimeo werden unterstützt',
    en: 'Only YouTube and Vimeo are supported',
  },

  // Frame dialog.
  'toolbar.frameDialogTitle': { de: 'Rahmen erstellen', en: 'Create frame' },
  'toolbar.frameDialogLabel': { de: 'Name', en: 'Name' },
  'toolbar.create': { de: 'Erstellen', en: 'Create' },

  // Link dialog.
  'toolbar.linkDialogTitle': { de: 'Link hinzufügen', en: 'Add link' },
  'toolbar.urlLabel': { de: 'URL', en: 'URL' },

  // Video dialog.
  'toolbar.videoDialogTitle': { de: 'Video einbetten', en: 'Embed video' },
  'toolbar.videoDialogLabel': { de: 'YouTube- oder Vimeo-Link', en: 'YouTube or Vimeo link' },
  'toolbar.videoDialogPlaceholder': {
    de: 'https://youtube.com/… oder https://vimeo.com/…',
    en: 'https://youtube.com/… or https://vimeo.com/…',
  },
  'toolbar.videoInvalid': {
    de: 'Nur YouTube- und Vimeo-Links werden unterstützt.',
    en: 'Only YouTube and Vimeo links are supported.',
  },

  // Toast errors.
  'toolbar.imageError': {
    de: 'Bild konnte nicht hinzugefügt werden.',
    en: 'Could not add image.',
  },
  'toolbar.linkError': {
    de: 'Link konnte nicht hinzugefügt werden.',
    en: 'Could not add link.',
  },
  'toolbar.videoError': {
    de: 'Video konnte nicht eingebettet werden.',
    en: 'Could not embed video.',
  },

  // Draw tools (each label doubles as its aria-label).
  'toolbar.pen': { de: 'Stift', en: 'Pen' },
  'toolbar.marker': { de: 'Marker', en: 'Marker' },
  'toolbar.line': { de: 'Linie', en: 'Line' },
  'toolbar.arrow': { de: 'Pfeil', en: 'Arrow' },
  'toolbar.rect': { de: 'Rechteck', en: 'Rectangle' },
  'toolbar.eraser': { de: 'Radierer', en: 'Eraser' },
  'toolbar.connect': { de: 'Verbinden', en: 'Connect' },

  // Draw tool title hints.
  'toolbar.lineTitle': { de: 'Linie ziehen', en: 'Draw line' },
  'toolbar.arrowTitle': { de: 'Pfeil ziehen', en: 'Draw arrow' },
  'toolbar.rectTitle': { de: 'Rechteck aufziehen', en: 'Draw rectangle' },

  // Undo / redo.
  'toolbar.undo': { de: 'Rückgängig', en: 'Undo' },
  'toolbar.redo': { de: 'Wiederholen', en: 'Redo' },
  'toolbar.undoTitle': { de: 'Rückgängig (Strg+Z)', en: 'Undo (Ctrl+Z)' },
  'toolbar.redoTitle': { de: 'Wiederholen (Strg+Umschalt+Z)', en: 'Redo (Ctrl+Shift+Z)' },

  // Draw options (interpolated).
  'toolbar.color': { de: 'Farbe {c}', en: 'Colour {c}' },
  'toolbar.strokeWidth': { de: 'Strichstärke {w}', en: 'Stroke width {w}' },
} satisfies Catalog
