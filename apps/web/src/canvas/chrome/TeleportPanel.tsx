import { screenToWorld } from '@corkspace/engine'
import { screenPoint } from '@corkspace/shared'
import { useValue } from 'signia-react'
import { createTeleportCommand, deleteTeleportCommand } from '../../commands/teleport-commands'
import { useDialogs } from '../../components/ui'
import { history } from '../../history/history'
import { useT } from '../../i18n'
import { flyTo } from '../runtime/fly-to'
import { boardAccessAtom } from '../state/board-store'
import { getCamera, viewportAtom } from '../state/camera-store'
import { teleportsAtom } from '../state/teleport-store'

/** Teleports: saved camera bookmarks. Clicking one flies there; editors can save the current view. */
export function TeleportPanel() {
  const teleports = useValue(teleportsAtom)
  const access = useValue(boardAccessAtom)
  const canEdit = access?.canEdit ?? false
  const list = [...teleports.values()]
  const { prompt } = useDialogs()
  const t = useT()

  const save = async (): Promise<void> => {
    const name = await prompt({
      title: t('boards.savePlaceTitle'),
      label: t('boards.name'),
      okText: t('common.save'),
    })
    if (!name) {
      return
    }
    const cam = getCamera()
    const vp = viewportAtom.value
    const center = screenToWorld(screenPoint(vp.w / 2, vp.h / 2), cam)
    await history.execute(
      createTeleportCommand({
        name,
        x: cam.x,
        y: cam.y,
        zoom: cam.zoom,
        isBoardButton: true,
        boardX: center.x,
        boardY: center.y,
      }),
    )
  }

  if (list.length === 0 && !canEdit) {
    return null
  }

  const linkBtn = 'btn btn-ghost btn-sm'

  return (
    <div
      data-export-ignore
      className="teleport-panel panel"
      data-no-pan
      data-ui-chrome
      style={{
        position: 'absolute',
        left: 8,
        top: 104,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxWidth: 208,
        padding: 8,
      }}
    >
      <span className="panel-title">{t('boards.places')}</span>
      {list.map((tp) => (
        <div key={tp.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            data-no-pan
            onClick={() => flyTo({ x: tp.x, y: tp.y, zoom: tp.zoom })}
            className={linkBtn}
            style={{
              flex: 1,
              justifyContent: 'flex-start',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tp.icon ?? '📍'} {tp.name}
          </button>
          {canEdit && (
            <button
              type="button"
              data-no-pan
              title={t('common.delete')}
              aria-label={t('boards.deletePlace')}
              onClick={() => void history.execute(deleteTeleportCommand(tp))}
              className="btn btn-ghost btn-icon"
              style={{ width: 24, height: 24, padding: 0, fontSize: 14 }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <button
          type="button"
          data-no-pan
          onClick={() => void save()}
          className="btn btn-accent btn-sm"
        >
          {t('boards.savePlace')}
        </button>
      )}
    </div>
  )
}
