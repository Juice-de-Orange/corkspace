import { useState } from 'react'
import { useValue } from 'signia-react'
import { assignTagsCommand, createTagCommand } from '../../commands/tag-commands'
import { useDialogs } from '../../components/ui'
import { history } from '../../history/history'
import { useT } from '../../i18n'
import { boardAccessAtom } from '../state/board-store'
import { entriesAtom } from '../state/entry-store'
import { selectedEntryIdAtom } from '../state/selection-state'
import { tagsAtom } from '../state/tag-store'

const PALETTE = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#6050dc', '#db2777']

/**
 * Admin tag manager (collapsible, top-right so it never overlaps the board's drag zones).
 * Create tags (a new tag styles its entries with a coloured border by default), and toggle tags
 * on the selected entry. Both go through the command stack (undoable).
 */
export function TagPanel() {
  const access = useValue(boardAccessAtom)
  const selectedId = useValue(selectedEntryIdAtom)
  const entries = useValue(entriesAtom)
  const tags = useValue(tagsAtom)
  const [open, setOpen] = useState(false)
  const { prompt } = useDialogs()
  const t = useT()

  if (!access?.canEdit) {
    return null
  }
  const selected = selectedId ? entries.get(selectedId) : undefined
  const selectedTagIds = new Set(selected?.tagIds ?? [])
  const tagList = [...tags.values()]

  const createTag = async (): Promise<void> => {
    const name = (
      await prompt({
        title: t('boards.tagCreateTitle'),
        label: t('boards.name'),
        okText: t('boards.create'),
      })
    )?.trim()
    if (!name) {
      return
    }
    const color = PALETTE[tags.size % PALETTE.length] ?? '#6050dc'
    void history.execute(createTagCommand({ name, color, styleRules: { borderColor: color } }))
  }
  const toggle = (tagId: string): void => {
    if (!selected) {
      return
    }
    const cur = new Set(selected.tagIds ?? [])
    if (cur.has(tagId)) {
      cur.delete(tagId)
    } else {
      cur.add(tagId)
    }
    void history.execute(assignTagsCommand(selected.id, selected.tagIds ?? [], [...cur]))
  }

  return (
    <>
      <button
        type="button"
        data-no-pan
        data-export-ignore
        data-tag-toggle
        data-ui-chrome
        onClick={() => setOpen((o) => !o)}
        className="btn btn-accent"
        style={{ position: 'absolute', right: 8, top: 176 }}
      >
        🏷 {t('boards.tags')}
      </button>
      {open && (
        <div
          className="tag-panel panel"
          data-no-pan
          data-export-ignore
          data-ui-chrome
          style={{
            position: 'absolute',
            right: 8,
            top: 212,
            width: 220,
            maxHeight: '60vh',
            overflow: 'auto',
            padding: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <span className="panel-title">{t('boards.tags')}</span>
            <button
              type="button"
              data-no-pan
              data-tag-create
              onClick={() => void createTag()}
              className="btn btn-sm btn-ghost"
            >
              {t('boards.addTag')}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--panel-muted)', marginBottom: 4 }}>
            {selected ? t('boards.tagAssignHint') : t('boards.tagSelectHint')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {tagList.length === 0 && (
              <div style={{ fontSize: 13, color: '#999' }}>{t('boards.noTags')}</div>
            )}
            {tagList.map((tag) => {
              const active = selectedTagIds.has(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  data-no-pan
                  data-tag-id={tag.id}
                  disabled={!selected}
                  onClick={() => toggle(tag.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 6px',
                    borderRadius: 6,
                    border: active ? `1px solid ${tag.color}` : '1px solid transparent',
                    background: active ? `${tag.color}22` : 'transparent',
                    cursor: selected ? 'pointer' : 'default',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: tag.color,
                      flex: '0 0 auto',
                    }}
                  />
                  <span style={{ fontSize: 13 }}>{tag.name}</span>
                  {active && <span style={{ marginLeft: 'auto', fontSize: 11 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
