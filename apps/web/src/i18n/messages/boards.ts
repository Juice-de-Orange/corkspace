import type { Catalog } from './types'

/** Dashboard overlay, graph, minimap, tag/teleport panels, zoom/position readouts. Prefix: `boards.*`. */
export const boards = {
  // DashboardOverlay — toggle button + tabs.
  'boards.search': { de: 'Suche', en: 'Search' },
  'boards.trashCount': { de: 'Papierkorb ({n})', en: 'Trash ({n})' },
  'boards.versions': { de: 'Versionen', en: 'Versions' },
  'boards.overview': { de: 'Übersicht', en: 'Overview' },
  'boards.graph': { de: 'Graph', en: 'Graph' },

  // DashboardOverlay — export button tooltips.
  'boards.exportPngTitle': {
    de: 'Sichtbaren Bereich als PNG exportieren',
    en: 'Export visible area as PNG',
  },
  'boards.exportPdfTitle': {
    de: 'Sichtbaren Bereich als PDF exportieren',
    en: 'Export visible area as PDF',
  },

  // DashboardOverlay — trash tab.
  'boards.trashEmpty': { de: 'Papierkorb ist leer', en: 'Trash is empty' },
  'boards.noText': { de: '(ohne Text)', en: '(no text)' },
  'boards.restore': { de: 'Wiederherstellen', en: 'Restore' },

  // DashboardOverlay — overview tab (stat words keep the count in a <strong> in JSX).
  'boards.statEntries': { de: 'Einträge', en: 'entries' },
  'boards.statConnections': { de: 'Verbindungen', en: 'connections' },
  'boards.statDeleted': { de: 'gelöscht', en: 'deleted' },
  'boards.orphansHeading': { de: 'Verwaiste Einträge ({n})', en: 'Orphaned entries ({n})' },
  'boards.noOrphans': { de: 'Keine verwaisten Einträge', en: 'No orphaned entries' },

  // DashboardOverlay — versions tab.
  'boards.selectForHistory': {
    de: 'Eintrag auswählen, um den Verlauf zu sehen',
    en: 'Select an entry to see its history',
  },
  'boards.noVersions': { de: 'Keine Versionen', en: 'No versions' },

  // DashboardOverlay — search facets.
  'boards.searchPlaceholder': {
    de: 'Suche (Text oder Tag-Name)…',
    en: 'Search (text or tag name)…',
  },
  'boards.linkAll': { de: 'alle', en: 'all' },
  'boards.linked': { de: 'verbunden', en: 'linked' },
  'boards.unlinked': { de: 'unverbunden', en: 'unlinked' },
  'boards.visibleRegion': { de: 'sichtbarer Bereich', en: 'visible area' },
  'boards.noResults': { de: 'Keine Treffer', en: 'No results' },

  // GraphView.
  'boards.connectionGraph': { de: 'Verbindungsgraph', en: 'Connection graph' },
  'boards.jumpTo': { de: 'Zu {label} springen', en: 'Jump to {label}' },

  // Minimap.
  'boards.map': { de: 'Karte', en: 'Map' },
  'boards.minimapShow': { de: 'Minimap einblenden', en: 'Show minimap' },
  'boards.minimapHide': { de: 'Minimap ausblenden', en: 'Hide minimap' },
  'boards.minimapHint': { de: 'Minimap – klicken zum Springen', en: 'Minimap – click to jump' },

  // TagPanel.
  'boards.tags': { de: 'Tags', en: 'Tags' },
  'boards.addTag': { de: '+ Tag', en: '+ Tag' },
  'boards.tagCreateTitle': { de: 'Tag erstellen', en: 'Create tag' },
  'boards.name': { de: 'Name', en: 'Name' },
  'boards.create': { de: 'Erstellen', en: 'Create' },
  'boards.tagAssignHint': {
    de: 'Tippen, um dem Eintrag zuzuweisen',
    en: 'Tap to assign to the entry',
  },
  'boards.tagSelectHint': {
    de: 'Eintrag auswählen, um zuzuweisen',
    en: 'Select an entry to assign',
  },
  'boards.noTags': { de: 'Noch keine Tags', en: 'No tags yet' },

  // TeleportPanel.
  'boards.places': { de: 'Orte', en: 'Places' },
  'boards.savePlaceTitle': { de: 'Ort speichern', en: 'Save place' },
  'boards.savePlace': { de: '+ Ort speichern', en: '+ Save place' },
  'boards.deletePlace': { de: 'Ort löschen', en: 'Delete place' },

  // ZoomControls.
  'boards.zoomOut': { de: 'Verkleinern', en: 'Zoom out' },
  'boards.zoomIn': { de: 'Vergrößern', en: 'Zoom in' },
} satisfies Catalog
