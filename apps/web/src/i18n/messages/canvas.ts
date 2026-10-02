import type { Catalog } from './types'

/** Entry components + selection/connection editors. Key prefix: `canvas.*`. */
export const canvas = {
  // ImageEntry
  'canvas.imageUnavailable': { de: 'Bild nicht verfügbar', en: 'Image unavailable' },
  'canvas.image': { de: 'Bild', en: 'Image' },
  // StickyEntry
  'canvas.doubleClickToEdit': { de: 'Doppelklick zum Bearbeiten', en: 'Double-click to edit' },
  // ChecklistEntry
  'canvas.checklist': { de: 'Checkliste', en: 'Checklist' },
  'canvas.removeItem': { de: 'Punkt entfernen', en: 'Remove item' },
  'canvas.addItem': { de: 'Punkt', en: 'Item' },
  // DocEntry toolbar
  'canvas.strikethrough': { de: 'Durchgestrichen', en: 'Strikethrough' },
  'canvas.orderedList': { de: 'Nummerierte Liste', en: 'Numbered list' },
  'canvas.copyEntryFirst': {
    de: 'Zuerst einen Eintrag kopieren (Strg+C), dann verknüpfen.',
    en: 'Copy an entry first (Ctrl+C), then link it.',
  },
  'canvas.linkedEntryText': { de: '→ Eintrag', en: '→ Entry' },
  'canvas.embedLinkUrl': { de: 'Link-URL einbetten:', en: 'Embed link URL:' },
  // LinkCard
  'canvas.video': { de: 'Video', en: 'Video' },
  // FrameLayer
  'canvas.deleteFrame': { de: 'Rahmen löschen', en: 'Delete frame' },
  // SelectionOverlay
  'canvas.edit': { de: 'Bearbeiten', en: 'Edit' },
  'canvas.visibilityPublic': {
    de: 'Öffentlich (für Betrachter sichtbar)',
    en: 'Public (visible to viewers)',
  },
  'canvas.visibilityPrivate': { de: 'Privat', en: 'Private' },
  'canvas.moveToTrash': { de: 'In den Papierkorb', en: 'Move to trash' },
  'canvas.bringToFront': { de: 'Nach vorne', en: 'Bring to front' },
  'canvas.sendToBack': { de: 'Nach hinten', en: 'Send to back' },
  // ConnectionEditor
  'canvas.labelPlaceholder': { de: 'Beschriftung…', en: 'Label…' },
  'canvas.arrowStart': { de: 'Pfeil am Anfang', en: 'Arrow at start' },
  'canvas.arrowEnd': { de: 'Pfeil am Ende', en: 'Arrow at end' },
  'canvas.color': { de: 'Farbe {col}', en: 'Colour {col}' },
  'canvas.deleteConnection': { de: 'Verbindung löschen', en: 'Delete connection' },
  'canvas.close': { de: 'Schließen', en: 'Close' },
} satisfies Catalog
