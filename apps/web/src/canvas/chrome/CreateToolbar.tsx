import { screenToWorld, worldSizeForNewEntry } from '@corkspace/engine'
import {
  type CreateEntryInput,
  MAX_TILT_DEG,
  parseVideoEmbed,
  REFERENCE_SIZES,
  STICKY_COLORS,
  screenPoint,
  screenSize,
} from '@corkspace/shared'
import { useRef } from 'react'
import { useValue } from 'signia-react'
import { createEntryCommand } from '../../commands/entry-commands'
import { createFrameCommand } from '../../commands/frame-commands'
import { createImageFromFile } from '../../commands/image'
import { createLinkFromUrl, createVideoFromUrl } from '../../commands/link'
import { Menu, useDialogs } from '../../components/ui'
import { history } from '../../history/history'
import { useT } from '../../i18n'
import { useMediaQuery } from '../../lib/use-media-query'
import { boardAccessAtom } from '../state/board-store'
import { cameraAtom, viewportAtom } from '../state/camera-store'
import {
  connectAnchorAtom,
  connectSourceAnchorAtom,
  connectToolAtom,
  pendingConnectFromAtom,
} from '../state/connection-store'
import { entriesAtom } from '../state/entry-store'
import {
  DRAW_COLORS,
  type DrawTool,
  drawToolAtom,
  PEN_WIDTHS,
  penColorAtom,
  penWidthAtom,
} from '../state/stroke-store'
import { pushError } from '../state/toast-store'

function nextZIndex(): number {
  let max = 0
  for (const e of entriesAtom.value.values()) {
    max = Math.max(max, e.zIndex)
  }
  return max + 1
}

function makeSticky(): CreateEntryInput {
  const cam = cameraAtom.value
  const vp = viewportAtom.value
  const center = screenToWorld(screenPoint(vp.w / 2, vp.h / 2), cam)
  const ref = REFERENCE_SIZES.sticky
  const size = worldSizeForNewEntry(screenSize(ref.w, ref.h), cam.zoom)
  const color = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)] ?? 'yellow'
  return {
    type: 'sticky',
    x: center.x - size.w / 2,
    y: center.y - size.h / 2,
    width: size.w,
    height: size.h,
    rotation: (Math.random() * 2 - 1) * MAX_TILT_DEG,
    zIndex: nextZIndex(),
    visibility: 'private',
    color,
    content: { text: '' },
  }
}

function makeDoc(paper?: 'lined' | 'grid'): CreateEntryInput {
  const cam = cameraAtom.value
  const vp = viewportAtom.value
  const center = screenToWorld(screenPoint(vp.w / 2, vp.h / 2), cam)
  const ref = REFERENCE_SIZES.doc
  const size = worldSizeForNewEntry(screenSize(ref.w, ref.h), cam.zoom)
  return {
    type: 'doc',
    x: center.x - size.w / 2,
    y: center.y - size.h / 2,
    width: size.w,
    height: size.h,
    rotation: (Math.random() * 2 - 1) * MAX_TILT_DEG,
    zIndex: nextZIndex(),
    visibility: 'private',
    // Paper style persisted in the (otherwise unused-for-docs) color field: 'lined' | 'grid' | none.
    ...(paper ? { color: paper } : {}),
    content: { doc: { type: 'doc', content: [{ type: 'paragraph' }] } },
  }
}

function makeChecklist(): CreateEntryInput {
  const cam = cameraAtom.value
  const vp = viewportAtom.value
  const center = screenToWorld(screenPoint(vp.w / 2, vp.h / 2), cam)
  const ref = REFERENCE_SIZES.checklist
  const size = worldSizeForNewEntry(screenSize(ref.w, ref.h), cam.zoom)
  return {
    type: 'checklist',
    x: center.x - size.w / 2,
    y: center.y - size.h / 2,
    width: size.w,
    height: size.h,
    rotation: (Math.random() * 2 - 1) * MAX_TILT_DEG,
    zIndex: nextZIndex(),
    visibility: 'private',
    content: { items: [] },
  }
}

/** Admin create + tools toolbar: grouped frosted bar with a contextual draw sub-toolbar. */
export function CreateToolbar() {
  const fileRef = useRef<HTMLInputElement>(null)
  const drawTool = useValue(drawToolAtom)
  const connectTool = useValue(connectToolAtom)
  const penColor = useValue(penColorAtom)
  const penWidth = useValue(penWidthAtom)
  const access = useValue(boardAccessAtom)
  const narrow = useMediaQuery('(max-width: 760px)')
  const { prompt } = useDialogs()
  const t = useT()

  const onCreateSticky = () => {
    void history.execute(createEntryCommand(makeSticky()))
  }
  const createDoc = (paper?: 'lined' | 'grid') => {
    void history.execute(createEntryCommand(makeDoc(paper)))
  }
  const toggleTool = (tool: DrawTool) => {
    connectToolAtom.set(false)
    pendingConnectFromAtom.set(null)
    connectAnchorAtom.set(null)
    connectSourceAnchorAtom.set(null)
    drawToolAtom.set(drawToolAtom.value === tool ? null : tool)
  }
  const toggleConnect = () => {
    drawToolAtom.set(null)
    const next = !connectToolAtom.value
    connectToolAtom.set(next)
    pendingConnectFromAtom.set(null)
    connectAnchorAtom.set(null)
    connectSourceAnchorAtom.set(null)
  }
  const onCreateFrame = async (): Promise<void> => {
    const name = await prompt({
      title: t('toolbar.frameDialogTitle'),
      label: t('toolbar.frameDialogLabel'),
      okText: t('toolbar.create'),
    })
    if (!name) {
      return
    }
    const cam = cameraAtom.value
    const vp = viewportAtom.value
    const center = screenToWorld(screenPoint(vp.w / 2, vp.h / 2), cam)
    const w = 700 / cam.zoom
    const h = 480 / cam.zoom
    await history.execute(
      createFrameCommand({ name, x: center.x - w / 2, y: center.y - h / 2, width: w, height: h }),
    )
  }
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void createImageFromFile(file).catch(() => pushError(t('toolbar.imageError')))
    }
    e.target.value = ''
  }

  const btn = 'btn btn-ghost'
  const iconBtn = 'btn btn-ghost btn-icon'

  // Read-only mode (viewer / external link): no create / draw controls.
  if (!access?.canEdit) {
    return null
  }

  const showDrawOptions = drawTool !== null && drawTool !== 'eraser'

  return (
    <div data-export-ignore data-ui-chrome className="create-toolbar">
      <div className="toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            aria-label={`+ ${t('toolbar.note')}`}
            onClick={onCreateSticky}
            className={btn}
          >
            <span aria-hidden="true">📝</span>
            <span className="btn-label">{t('toolbar.note')}</span>
          </button>
          <div style={{ display: 'inline-flex' }}>
            <button
              type="button"
              aria-label={`+ ${t('toolbar.doc')}`}
              title={t('toolbar.docTitle')}
              onClick={() => createDoc()}
              className={btn}
            >
              <span aria-hidden="true">📄</span>
              <span className="btn-label">{t('toolbar.doc')}</span>
            </button>
            <Menu
              triggerLabel={t('toolbar.paperType')}
              triggerClassName="btn btn-ghost btn-icon btn-sm"
              triggerContent="▾"
              direction={narrow ? 'up' : 'down'}
            >
              {(close) => (
                <>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      createDoc()
                      close()
                    }}
                  >
                    {t('toolbar.paperBlank')}
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      createDoc('lined')
                      close()
                    }}
                  >
                    {t('toolbar.paperLined')}
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      createDoc('grid')
                      close()
                    }}
                  >
                    {t('toolbar.paperGrid')}
                  </button>
                </>
              )}
            </Menu>
          </div>
          <button
            type="button"
            aria-label={`+ ${t('toolbar.list')}`}
            onClick={() => void history.execute(createEntryCommand(makeChecklist()))}
            className={btn}
          >
            <span aria-hidden="true">☑️</span>
            <span className="btn-label">{t('toolbar.list')}</span>
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button
            type="button"
            aria-label={`+ ${t('toolbar.image')}`}
            onClick={() => fileRef.current?.click()}
            className={btn}
          >
            <span aria-hidden="true">🖼️</span>
            <span className="btn-label">{t('toolbar.image')}</span>
          </button>
          <button
            type="button"
            aria-label={`+ ${t('toolbar.link')}`}
            onClick={async () => {
              const url = await prompt({
                title: t('toolbar.linkDialogTitle'),
                label: t('toolbar.urlLabel'),
                placeholder: 'https://…',
              })
              if (url) {
                void createLinkFromUrl(url).catch(() => pushError(t('toolbar.linkError')))
              }
            }}
            className={btn}
          >
            <span aria-hidden="true">🔗</span>
            <span className="btn-label">{t('toolbar.link')}</span>
          </button>
          <button
            type="button"
            aria-label={`+ ${t('toolbar.video')}`}
            title={t('toolbar.videoTitle')}
            onClick={async () => {
              const url = await prompt({
                title: t('toolbar.videoDialogTitle'),
                label: t('toolbar.videoDialogLabel'),
                placeholder: t('toolbar.videoDialogPlaceholder'),
                validate: (v) => (parseVideoEmbed(v.trim()) ? null : t('toolbar.videoInvalid')),
              })
              if (url) {
                void createVideoFromUrl(url).catch(() => pushError(t('toolbar.videoError')))
              }
            }}
            className={btn}
          >
            <span aria-hidden="true">🎬</span>
            <span className="btn-label">{t('toolbar.video')}</span>
          </button>
          <button
            type="button"
            aria-label={`+ ${t('toolbar.frame')}`}
            onClick={() => void onCreateFrame()}
            className={btn}
          >
            <span aria-hidden="true">⬜</span>
            <span className="btn-label">{t('toolbar.frame')}</span>
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button
            type="button"
            data-draw-tool="pen"
            aria-label={t('toolbar.pen')}
            onClick={() => toggleTool('pen')}
            className={drawTool === 'pen' ? `${btn} is-active` : btn}
          >
            ✏️ <span className="btn-label">{t('toolbar.pen')}</span>
          </button>
          <button
            type="button"
            data-draw-tool="marker"
            aria-label={t('toolbar.marker')}
            onClick={() => toggleTool('marker')}
            className={drawTool === 'marker' ? `${btn} is-active` : btn}
          >
            🖊️ <span className="btn-label">{t('toolbar.marker')}</span>
          </button>
          <button
            type="button"
            data-draw-tool="line"
            aria-label={t('toolbar.line')}
            title={t('toolbar.lineTitle')}
            onClick={() => toggleTool('line')}
            className={drawTool === 'line' ? `${btn} is-active` : btn}
          >
            ➖ <span className="btn-label">{t('toolbar.line')}</span>
          </button>
          <button
            type="button"
            data-draw-tool="arrow"
            aria-label={t('toolbar.arrow')}
            title={t('toolbar.arrowTitle')}
            onClick={() => toggleTool('arrow')}
            className={drawTool === 'arrow' ? `${btn} is-active` : btn}
          >
            ↗ <span className="btn-label">{t('toolbar.arrow')}</span>
          </button>
          <button
            type="button"
            data-draw-tool="rect"
            aria-label={t('toolbar.rect')}
            title={t('toolbar.rectTitle')}
            onClick={() => toggleTool('rect')}
            className={drawTool === 'rect' ? `${btn} is-active` : btn}
          >
            ▭ <span className="btn-label">{t('toolbar.rect')}</span>
          </button>
          <button
            type="button"
            data-draw-tool="eraser"
            aria-label={t('toolbar.eraser')}
            onClick={() => toggleTool('eraser')}
            className={drawTool === 'eraser' ? `${btn} is-active` : btn}
          >
            🧽 <span className="btn-label">{t('toolbar.eraser')}</span>
          </button>
          <button
            type="button"
            data-connect-tool
            aria-label={t('toolbar.connect')}
            onClick={toggleConnect}
            className={connectTool ? `${btn} is-active` : btn}
          >
            🧵 <span className="btn-label">{t('toolbar.connect')}</span>
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button
            type="button"
            data-undo
            aria-label={t('toolbar.undo')}
            title={t('toolbar.undoTitle')}
            onClick={() => void history.undo()}
            className={iconBtn}
          >
            ↶
          </button>
          <button
            type="button"
            data-redo
            aria-label={t('toolbar.redo')}
            title={t('toolbar.redoTitle')}
            onClick={() => void history.redo()}
            className={iconBtn}
          >
            ↷
          </button>
        </div>
      </div>

      {showDrawOptions && (
        <div className="toolbar" data-draw-options>
          <div className="toolbar-group">
            {DRAW_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                data-draw-color={col}
                aria-label={t('toolbar.color', { c: col })}
                onClick={() => penColorAtom.set(col)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: col,
                  cursor: 'pointer',
                  border: penColor === col ? '2px solid var(--panel-text)' : '2px solid #fff',
                  boxShadow: '0 0 0 1px var(--panel-border)',
                }}
              />
            ))}
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            {PEN_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                data-draw-width={w}
                aria-label={t('toolbar.strokeWidth', { w })}
                onClick={() => penWidthAtom.set(w)}
                className={penWidth === w ? `${iconBtn} is-active` : iconBtn}
              >
                <span
                  style={{
                    display: 'block',
                    width: Math.max(3, w + 1),
                    height: Math.max(3, w + 1),
                    borderRadius: '50%',
                    background: 'currentColor',
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        data-no-pan
        onChange={onFile}
        style={{ display: 'none' }}
      />
    </div>
  )
}
