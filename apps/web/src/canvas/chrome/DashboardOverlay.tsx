import { cameraForRect, screenToWorld } from '@corkspace/engine'
import {
  ENTRY_TYPE_LABEL,
  ENTRY_TYPES,
  type EntryType,
  type Graph,
  type SearchParams,
  screenPoint,
  screenSize,
} from '@corkspace/shared'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useValue } from 'signia-react'
import {
  apiGraph,
  apiOrphans,
  apiRestore,
  apiRestoreVersion,
  apiSearch,
  apiStats,
  apiTrash,
  apiVersions,
  type DashboardStats,
  type EntryVersion,
  type OrphanItem,
  type SearchResult,
  type TrashItem,
} from '../../api/dashboard'
import { fetchEntryMetas } from '../../api/entries'
import { localized, useT } from '../../i18n'
import { exportViewportPdf, exportViewportPng } from '../export/export-viewport'
import { flyTo } from '../runtime/fly-to'
import { boardAccessAtom } from '../state/board-store'
import { getCamera, viewportAtom } from '../state/camera-store'
import { bumpEntryContentRev, loadEntries } from '../state/entry-store'
import { selectedEntryIdAtom } from '../state/selection-state'

// Lazy so d3-force lands in its own chunk (code-split out of the main bundle).
const GraphView = lazy(() => import('./GraphView'))

const fmtDate = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

const stripTags = (s: string): string => s.replace(/<\/?b>/g, '')
const typeLabel = (t: string): string => {
  const label = ENTRY_TYPE_LABEL[t as EntryType]
  return label ? localized(label) : t
}

/**
 * Per-board dashboard overlay: faceted full-text search (with jump-to flight), trash + restore,
 * per-entry version history, an overview (stats + orphans), and the connection graph (lazy).
 * (Feedback triage lives on the central /admin dashboard, not here.)
 */
export function DashboardOverlay() {
  const t = useT()
  const access = useValue(boardAccessAtom)
  const selectedId = useValue(selectedEntryIdAtom)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'search' | 'trash' | 'versions' | 'overview'>('search')
  const [q, setQ] = useState('')
  const [types, setTypes] = useState<ReadonlySet<EntryType>>(new Set())
  const [linkStatus, setLinkStatus] = useState<'' | 'linked' | 'unlinked'>('')
  const [regionOnly, setRegionOnly] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [trash, setTrash] = useState<TrashItem[]>([])
  const [versions, setVersions] = useState<EntryVersion[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [orphans, setOrphans] = useState<OrphanItem[]>([])
  const [graph, setGraph] = useState<Graph | null>(null)

  // Re-run the faceted search whenever the dashboard is open on the search tab and any facet
  // changes. Building params here keeps a single source of truth (no stale-closure setters);
  // viewportAtom/getCamera are read live (module-level, not reactive deps).
  useEffect(() => {
    if (!open || tab !== 'search') {
      return
    }
    const params: SearchParams = {}
    if (q.trim()) {
      params.q = q.trim()
    }
    if (types.size > 0) {
      params.types = [...types]
    }
    if (linkStatus) {
      params.linkStatus = linkStatus
    }
    if (dateFrom) {
      params.createdAfter = new Date(dateFrom).toISOString()
    }
    if (dateTo) {
      params.createdBefore = new Date(`${dateTo}T23:59:59`).toISOString()
    }
    if (regionOnly) {
      const vp = viewportAtom.value
      const cam = getCamera()
      const tl = screenToWorld(screenPoint(0, 0), cam)
      const br = screenToWorld(screenPoint(vp.w, vp.h), cam)
      params.region = { minX: tl.x, minY: tl.y, maxX: br.x, maxY: br.y }
    }
    let cancelled = false
    // Debounce so typing fires one request, not one per keystroke.
    const timer = setTimeout(() => {
      void apiSearch(params)
        .then((r) => {
          if (!cancelled) {
            setResults(r)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults([])
          }
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, tab, q, types, linkStatus, regionOnly, dateFrom, dateTo])

  // The in-board dashboard (search/trash/versions/overview/graph) is per-board — owner/editor only.
  if (!access?.canSeePrivate) {
    return null
  }

  const toggleType = (ty: EntryType): void => {
    setTypes((cur) => {
      const next = new Set(cur)
      if (next.has(ty)) {
        next.delete(ty)
      } else {
        next.add(ty)
      }
      return next
    })
  }
  const loadTrash = (): void => {
    void apiTrash()
      .then(setTrash)
      .catch(() => setTrash([]))
  }
  const restore = (id: string): void => {
    void apiRestore(id)
      .then(() => fetchEntryMetas())
      .then((metas) => {
        loadEntries(metas) // restored entry reappears on the board
        loadTrash()
      })
      .catch(() => {})
  }
  const jumpTo = (rect: { x: number; y: number; width: number; height: number }): void => {
    const vp = viewportAtom.value
    flyTo(
      cameraForRect(
        { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        screenSize(vp.w, vp.h),
      ),
    )
    setOpen(false)
  }
  const loadOverview = (): void => {
    void apiStats()
      .then(setStats)
      .catch(() => setStats(null))
    void apiOrphans()
      .then(setOrphans)
      .catch(() => setOrphans([]))
  }
  const openGraph = (): void => {
    void apiGraph()
      .then(setGraph)
      .catch(() => setGraph(null))
  }
  const loadVersions = (id: string | null): void => {
    if (!id) {
      setVersions([])
      return
    }
    void apiVersions(id)
      .then(setVersions)
      .catch(() => setVersions([]))
  }
  const restoreVersion = (vid: string): void => {
    if (!selectedId) {
      return
    }
    const id = selectedId
    void apiRestoreVersion(id, vid)
      .then(() => {
        bumpEntryContentRev(id) // force the board entry to re-fetch its restored content
        loadVersions(id) // restore captures the pre-restore state → list grew
      })
      .catch(() => {})
  }

  const tabBtn = (id: typeof tab, label: string, onPick: () => void) => (
    <button
      type="button"
      data-no-pan
      data-dashboard-tab={id}
      role="tab"
      aria-selected={tab === id}
      onClick={onPick}
      className={tab === id ? 'tab is-active' : 'tab'}
    >
      {label}
    </button>
  )

  return (
    <>
      <button
        type="button"
        data-no-pan
        data-export-ignore
        data-dashboard-toggle
        data-ui-chrome
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) {
            loadTrash()
          }
        }}
        className="btn btn-accent"
        style={{ position: 'absolute', right: 8, bottom: 8 }}
      >
        🔍 {t('boards.search')}
      </button>
      {open && (
        <div
          className="dashboard-overlay panel"
          data-no-pan
          data-export-ignore
          data-ui-chrome
          style={{
            position: 'absolute',
            right: 8,
            bottom: 48,
            width: 320,
            maxHeight: '60vh',
            overflow: 'auto',
            padding: 'var(--space-2)',
          }}
        >
          <div className="tabs" role="tablist" style={{ marginBottom: 'var(--space-2)' }}>
            {tabBtn('search', t('boards.search'), () => setTab('search'))}
            {tabBtn('trash', t('boards.trashCount', { n: trash.length }), () => {
              setTab('trash')
              loadTrash()
            })}
            {tabBtn('versions', t('boards.versions'), () => {
              setTab('versions')
              loadVersions(selectedId)
            })}
            {tabBtn('overview', t('boards.overview'), () => {
              setTab('overview')
              loadOverview()
            })}
          </div>
          <div
            style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}
          >
            <button
              type="button"
              data-no-pan
              data-dashboard-graph
              onClick={openGraph}
              className="btn btn-sm btn-ghost"
            >
              {t('boards.graph')}
            </button>
            <button
              type="button"
              data-no-pan
              data-export-png
              title={t('boards.exportPngTitle')}
              onClick={() => void exportViewportPng()}
              className="btn btn-sm btn-ghost"
            >
              PNG
            </button>
            <button
              type="button"
              data-no-pan
              data-export-pdf
              title={t('boards.exportPdfTitle')}
              onClick={() => void exportViewportPdf()}
              className="btn btn-sm btn-ghost"
            >
              PDF
            </button>
          </div>

          {tab === 'trash' && (
            <div
              className="dashboard-trash"
              style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              {trash.length === 0 && (
                <div className="muted" style={{ fontSize: 'var(--text-sm)', padding: 4 }}>
                  {t('boards.trashEmpty')}
                </div>
              )}
              {trash.map((item) => (
                <div
                  key={item.id}
                  data-trash-id={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 'var(--text-sm)',
                    padding: '2px 4px',
                  }}
                >
                  <span style={{ color: 'var(--accent)' }}>{typeLabel(item.type)}</span>
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {stripTags(item.snippet) || t('boards.noText')}
                  </span>
                  <button
                    type="button"
                    data-no-pan
                    data-restore-id={item.id}
                    onClick={() => restore(item.id)}
                    style={{ color: 'var(--accent)', fontSize: 'var(--text-xs)' }}
                  >
                    {t('boards.restore')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'overview' && (
            <div
              className="dashboard-overview"
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <div
                className="dashboard-stats"
                style={{ display: 'flex', gap: 10, fontSize: 'var(--text-sm)', padding: '2px 4px' }}
              >
                <span data-stat="entries">
                  <strong>{stats?.entries ?? '–'}</strong> {t('boards.statEntries')}
                </span>
                <span data-stat="connections">
                  <strong>{stats?.connections ?? '–'}</strong> {t('boards.statConnections')}
                </span>
                <span data-stat="deleted">
                  <strong>{stats?.deleted ?? '–'}</strong> {t('boards.statDeleted')}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 'var(--text-xs)', padding: '2px 4px' }}>
                {t('boards.orphansHeading', { n: orphans.length })}
              </div>
              {orphans.length === 0 && (
                <div className="muted" style={{ fontSize: 'var(--text-sm)', padding: 4 }}>
                  {t('boards.noOrphans')}
                </div>
              )}
              {orphans.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  data-no-pan
                  data-orphan-id={o.id}
                  onClick={() => jumpTo(o)}
                  style={{
                    textAlign: 'left',
                    padding: '4px 6px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)',
                    display: 'flex',
                    gap: 6,
                  }}
                >
                  <span style={{ color: 'var(--accent)' }}>{typeLabel(o.type)}</span>
                  <span className="muted">
                    ({Math.round(o.x)}, {Math.round(o.y)})
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === 'versions' && (
            <div
              className="dashboard-versions"
              style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              {!selectedId && (
                <div className="muted" style={{ fontSize: 'var(--text-sm)', padding: 4 }}>
                  {t('boards.selectForHistory')}
                </div>
              )}
              {selectedId && versions.length === 0 && (
                <div className="muted" style={{ fontSize: 'var(--text-sm)', padding: 4 }}>
                  {t('boards.noVersions')}
                </div>
              )}
              {selectedId &&
                versions.map((v) => (
                  <div
                    key={v.id}
                    data-version-id={v.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 'var(--text-sm)',
                      padding: '2px 4px',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtDate(v.versionAt)}
                    </span>
                    <button
                      type="button"
                      data-no-pan
                      data-restore-version={v.id}
                      onClick={() => restoreVersion(v.id)}
                      style={{ color: 'var(--accent)', fontSize: 'var(--text-xs)' }}
                    >
                      {t('boards.restore')}
                    </button>
                  </div>
                ))}
            </div>
          )}

          {tab === 'search' && (
            <div className="dashboard-facets" style={{ marginBottom: 'var(--space-2)' }}>
              <input
                className="input input-sm"
                data-no-pan
                data-dashboard-search
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('boards.searchPlaceholder')}
                style={{ marginBottom: 'var(--space-2)' }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
                {ENTRY_TYPES.map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    data-no-pan
                    data-facet-type={ty}
                    aria-pressed={types.has(ty)}
                    onClick={() => toggleType(ty)}
                    className={types.has(ty) ? 'btn btn-sm is-active' : 'btn btn-sm btn-ghost'}
                  >
                    {localized(ENTRY_TYPE_LABEL[ty])}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <select
                  className="select input-sm"
                  data-no-pan
                  data-facet-link-status
                  value={linkStatus}
                  onChange={(e) => setLinkStatus(e.target.value as '' | 'linked' | 'unlinked')}
                  style={{ width: 'auto' }}
                >
                  <option value="">{t('boards.linkAll')}</option>
                  <option value="linked">{t('boards.linked')}</option>
                  <option value="unlinked">{t('boards.unlinked')}</option>
                </select>
                <label
                  style={{
                    fontSize: 'var(--text-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <input
                    type="checkbox"
                    data-no-pan
                    data-facet-region
                    checked={regionOnly}
                    onChange={(e) => setRegionOnly(e.target.checked)}
                  />
                  {t('boards.visibleRegion')}
                </label>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 'var(--text-xs)',
                }}
              >
                <input
                  type="date"
                  className="input input-sm"
                  data-no-pan
                  data-facet-date-from
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ width: 'auto' }}
                />
                <span>–</span>
                <input
                  type="date"
                  className="input input-sm"
                  data-no-pan
                  data-facet-date-to
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ width: 'auto' }}
                />
              </div>
            </div>
          )}
          <div
            className="dashboard-results"
            style={{
              display: tab === 'search' ? 'flex' : 'none',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {results.length === 0 && (
              <div className="muted" style={{ fontSize: 'var(--text-sm)', padding: 4 }}>
                {t('boards.noResults')}
              </div>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                data-no-pan
                data-result-id={r.id}
                onClick={() => jumpTo(r)}
                style={{
                  textAlign: 'left',
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)',
                  display: 'flex',
                  gap: 6,
                }}
              >
                <span style={{ color: 'var(--accent)' }}>{typeLabel(r.type)}</span>
                <span
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {stripTags(r.snippet) || t('boards.noText')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {graph && (
        <Suspense fallback={null}>
          <GraphView
            graph={graph}
            width={Math.min(900, Math.max(320, viewportAtom.value.w - 80))}
            height={Math.min(640, Math.max(320, viewportAtom.value.h - 80))}
            onClose={() => setGraph(null)}
            onPick={(rect) => {
              jumpTo(rect)
              setGraph(null)
            }}
          />
        </Suspense>
      )}
    </>
  )
}
