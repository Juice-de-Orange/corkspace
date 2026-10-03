import { ENTRY_TYPE_COLOR, ENTRY_TYPE_LABEL, type EntryType, type Graph } from '@corkspace/shared'
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { useMemo } from 'react'
import { localized, useT } from '../../i18n'

interface SimNode extends SimulationNodeDatum {
  id: string
  type: string
  boardX: number
  boardY: number
  boardW: number
  boardH: number
  degree: number
}
type SimLink = SimulationLinkDatum<SimNode>

export interface GraphViewProps {
  graph: Graph
  width: number
  height: number
  onPick: (rect: { x: number; y: number; width: number; height: number }) => void
  onClose: () => void
}

/**
 * Connection graph (lazy-loaded so d3-force is code-split out of the main bundle). The force
 * simulation is ticked synchronously to a fixed count → a deterministic static layout (no
 * animation, stable for tests). Clicking a node flies the board camera to that entry.
 */
export default function GraphView({ graph, width, height, onPick, onClose }: GraphViewProps) {
  const t = useT()
  const nodes = useMemo<SimNode[]>(() => {
    const ns: SimNode[] = graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      boardX: n.x,
      boardY: n.y,
      boardW: n.width,
      boardH: n.height,
      degree: n.degree,
    }))
    const links: SimLink[] = graph.edges.map((e) => ({ source: e.from, target: e.to }))
    forceSimulation<SimNode>(ns)
      .force('charge', forceManyBody<SimNode>().strength(-160))
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(70),
      )
      .force('center', forceCenter<SimNode>(width / 2, height / 2))
      .stop()
      .tick(300)
    return ns
  }, [graph, width, height])

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const at = (n: SimNode | undefined): { x: number; y: number } => ({
    x: n?.x ?? width / 2,
    y: n?.y ?? height / 2,
  })

  return (
    <div
      className="graph-modal"
      data-no-pan
      data-ui-chrome
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3_000_000,
      }}
    >
      <div
        style={{
          position: 'relative',
          background: 'var(--panel)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          data-no-pan
          data-graph-close
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            fontSize: 14,
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid var(--panel-border)',
            background: 'var(--panel)',
            color: 'var(--panel-text)',
          }}
        >
          ✕
        </button>
        <svg
          className="graph-svg"
          width={width}
          height={height}
          role="img"
          aria-label={t('boards.connectionGraph')}
        >
          <title>{t('boards.connectionGraph')}</title>
          {graph.edges.map((e) => {
            const s = at(byId.get(e.from))
            const tgt = at(byId.get(e.to))
            return (
              <line
                key={e.id}
                x1={s.x}
                y1={s.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="rgba(128,128,128,0.55)"
                strokeWidth={1}
              />
            )
          })}
          {nodes.map((n) => {
            const p = at(n)
            const pick = (): void =>
              onPick({ x: n.boardX, y: n.boardY, width: n.boardW, height: n.boardH })
            return (
              // biome-ignore lint/a11y/useSemanticElements: SVG has no <button>; the circle carries role, focus and Enter/Space handling itself.
              <circle
                key={n.id}
                data-graph-node={n.id}
                role="button"
                tabIndex={0}
                aria-label={t('boards.jumpTo', {
                  label: ENTRY_TYPE_LABEL[n.type as EntryType]
                    ? localized(ENTRY_TYPE_LABEL[n.type as EntryType])
                    : n.type,
                })}
                cx={p.x}
                cy={p.y}
                r={6 + Math.min(n.degree, 8) * 1.5}
                fill={ENTRY_TYPE_COLOR[n.type as EntryType] ?? '#9ca3af'}
                stroke="#fff"
                strokeWidth={1.5}
                style={{ cursor: 'pointer' }}
                onClick={pick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    pick()
                  }
                }}
              />
            )
          })}
        </svg>
      </div>
    </div>
  )
}
