import {
  BACKGROUND_LABEL,
  BACKGROUNDS,
  type Background,
  ENTRY_TYPE_LABEL,
  FONT_KEYS,
  FONT_LABEL,
  type FontKey,
  type PartialSettings,
  resolveEffectiveSettings,
  STICKY_COLOR_LABEL,
  STICKY_COLORS,
  type StickyColor,
} from '@corkspace/shared'
import { type ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPatchBoard, type BoardMetaResponse, fetchBoardMeta } from '../api/boards'
import { Field, PageShell, useToast } from '../components/ui'
import { localized, useT } from '../i18n'
import { applySettings } from '../lib/apply-settings'

const TYPES = ['sticky', 'doc', 'checklist', 'link'] as const
type TypeKey = (typeof TYPES)[number]

/** Account settings → per-board appearance. Sparse overrides inheriting the global defaults. */
export function AccountSettings() {
  const navigate = useNavigate()
  const toast = useToast()
  const t = useT()
  const [board, setBoard] = useState<BoardMetaResponse | null>(null)
  const [overrides, setOverrides] = useState<PartialSettings>({})

  useEffect(() => {
    void (async () => {
      const me = (await fetch('/api/me', { credentials: 'include' }).then((r) => r.json())) as {
        defaultBoardId?: string | null
      }
      if (!me.defaultBoardId) {
        return
      }
      const b = await fetchBoardMeta(me.defaultBoardId)
      setBoard(b)
      setOverrides(b.rawSettings ?? {})
    })()
  }, [])

  if (!board) {
    return (
      <PageShell title={t('forms.accountTitle')} narrow>
        <div className="empty-state">{t('common.loading')}</div>
      </PageShell>
    )
  }

  const eff = resolveEffectiveSettings(board.globalDefaults, overrides)

  const save = (next: PartialSettings): void => {
    setOverrides(next)
    applySettings(resolveEffectiveSettings(board.globalDefaults, next))
    void apiPatchBoard(board.id, { settings: next })
  }
  const setSize = (key: TypeKey, v: number): void =>
    save({ ...overrides, fontSizes: { ...overrides.fontSizes, [key]: v } })
  const setFont = (key: TypeKey, v: FontKey): void =>
    save({ ...overrides, fonts: { ...overrides.fonts, [key]: v } })

  return (
    <PageShell
      title={t('forms.accountTitle')}
      subtitle={t('forms.accountSubtitle')}
      narrow
      actions={
        <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate(-1)}>
          {t('common.back')}
        </button>
      }
    >
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t('forms.boardAppearance')}</h2>
        </div>
        <p className="hint" style={{ marginBottom: 'var(--space-5)' }}>
          {t('forms.appearanceIntro')}
        </p>

        <Field
          label={t('forms.background')}
          badge={<OverrideBadge has={overrides.background !== undefined} />}
        >
          {(p) => (
            <select
              {...p}
              className="select"
              value={eff.background}
              onChange={(e) => save({ ...overrides, background: e.target.value as Background })}
            >
              {BACKGROUNDS.map((b) => (
                <option key={b} value={b}>
                  {localized(BACKGROUND_LABEL[b])}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          label={t('forms.stickyDefaultColor')}
          badge={<OverrideBadge has={overrides.stickyDefaultColor !== undefined} />}
        >
          {(p) => (
            <select
              {...p}
              className="select"
              value={eff.stickyDefaultColor}
              onChange={(e) =>
                save({ ...overrides, stickyDefaultColor: e.target.value as StickyColor })
              }
            >
              {STICKY_COLORS.map((c) => (
                <option key={c} value={c}>
                  {localized(STICKY_COLOR_LABEL[c])}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Divider>{t('forms.fontSizes')}</Divider>
        {TYPES.map((k) => (
          <Field
            key={k}
            label={localized(ENTRY_TYPE_LABEL[k])}
            badge={<OverrideBadge has={overrides.fontSizes?.[k] !== undefined} />}
          >
            {(p) => (
              <input
                {...p}
                className="input"
                type="number"
                min={8}
                max={200}
                value={eff.fontSizes[k]}
                onChange={(e) => setSize(k, Number(e.target.value))}
              />
            )}
          </Field>
        ))}

        <Divider>{t('forms.fonts')}</Divider>
        {TYPES.map((k) => (
          <Field
            key={k}
            label={localized(ENTRY_TYPE_LABEL[k])}
            badge={<OverrideBadge has={overrides.fonts?.[k] !== undefined} />}
          >
            {(p) => (
              <select
                {...p}
                className="select"
                value={eff.fonts[k]}
                onChange={(e) => setFont(k, e.target.value as FontKey)}
              >
                {FONT_KEYS.map((f) => (
                  <option key={f} value={f}>
                    {localized(FONT_LABEL[f])}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ))}

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 'var(--space-5)' }}
          onClick={() => {
            save({})
            toast.success(t('forms.resetToast'))
          }}
        >
          {t('forms.resetAll')}
        </button>
      </div>
    </PageShell>
  )
}

function OverrideBadge({ has }: { has: boolean }) {
  const t = useT()
  return has ? (
    <span className="badge badge-accent">{t('forms.badgeCustom')}</span>
  ) : (
    <span className="badge">{t('forms.badgeDefault')}</span>
  )
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        margin: 'var(--space-6) 0 var(--space-3)',
      }}
    >
      {children}
    </h3>
  )
}
