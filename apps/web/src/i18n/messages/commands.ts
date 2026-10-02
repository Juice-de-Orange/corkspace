import type { Catalog } from './types'

/** Imperative command/error-toast strings (commands/*.ts, use-image-drop-paste). Prefix: `cmd.*`. */
export const commands = {
  'cmd.saveFailed': {
    de: 'Speichern fehlgeschlagen.',
    en: 'Saving failed. Please try again.',
  },
  'cmd.strokeSaveFailed': {
    de: 'Zeichnung konnte nicht gespeichert werden.',
    en: 'Could not save the drawing.',
  },
  'cmd.restoreFailed': {
    de: 'Konnte nicht wiederhergestellt werden.',
    en: 'Could not restore.',
  },
  'cmd.connectFailed': {
    de: 'Verbindung konnte nicht erstellt werden.',
    en: 'Could not create the connection.',
  },
  'cmd.patchFailed': {
    de: 'Änderung konnte nicht gespeichert werden.',
    en: 'Could not save the change.',
  },
  'cmd.frameDeleteFailed': {
    de: 'Rahmen konnte nicht gelöscht werden.',
    en: 'Could not delete the frame.',
  },
  'cmd.teleportDeleteFailed': {
    de: 'Ort konnte nicht gelöscht werden.',
    en: 'Could not delete the place.',
  },
  'cmd.imageAddFailed': {
    de: 'Bild konnte nicht hinzugefügt werden.',
    en: 'Could not add the image.',
  },
} satisfies Catalog
