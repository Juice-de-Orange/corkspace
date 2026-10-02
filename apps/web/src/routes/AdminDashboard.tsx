import {
  BACKGROUND_LABEL,
  BACKGROUNDS,
  type Background,
  FONT_KEYS,
  FONT_LABEL,
  type FontKey,
  type PartialSettings,
  resolveEffectiveSettings,
} from '@corkspace/shared'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  type AdminBoard,
  type AdminUser,
  adminCreateUser,
  adminDeleteUser,
  adminGetSettings,
  adminListBoards,
  adminListUsers,
  adminPatchUser,
  adminPutSettings,
} from '../api/admin'
import {
  apiDeleteFeedback,
  apiGetFeedback,
  apiListFeedback,
  apiSetFeedbackStatus,
  type FeedbackListItem,
} from '../api/feedback'
import { pushError } from '../canvas/state/toast-store'
import { Field, IconButton, Modal, PageShell, Segmented, Tabs, useToast } from '../components/ui'
import { dateLocale, localized, useT } from '../i18n'
import { useSession } from '../lib/auth-client'

type Tab = 'users' | 'boards' | 'feedback' | 'defaults' | 'stats'

/** Central super-admin dashboard: users, boards, feedback, global defaults, stats. */
export function AdminDashboard() {
  const navigate = useNavigate()
  const t = useT()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('users')

  const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: 'users', label: t('admin.tabUsers') },
    { id: 'boards', label: t('admin.tabBoards') },
    { id: 'feedback', label: t('admin.tabFeedback') },
    { id: 'defaults', label: t('admin.tabDefaults') },
    { id: 'stats', label: t('admin.tabStats') },
  ]

  useEffect(() => {
    void fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ role?: string }>) : null))
      .then((d) => setAuthorized(d?.role === 'admin'))
      .catch(() => setAuthorized(false))
  }, [])

  if (authorized === null) {
    return (
      <div className="page">
        <div className="empty-state">{t('common.loading')}</div>
      </div>
    )
  }
  if (!authorized) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>{t('admin.noAccess')}</p>
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate('/')}>
            {t('admin.toBoard')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <PageShell
      title={t('admin.title')}
      actions={
        <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate('/')}>
          {t('admin.backToBoard')}
        </button>
      }
    >
      <Tabs tabs={tabs} active={tab} onChange={setTab} ariaLabel={t('admin.title')} />
      {tab === 'users' && <UsersTab />}
      {tab === 'boards' && <BoardsTab />}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'defaults' && <DefaultsTab />}
      {tab === 'stats' && <StatsTab />}
    </PageShell>
  )
}

function UsersTab() {
  const t = useT()
  const { data: session } = useSession()
  const selfId = session?.user.id
  const [users, setUsers] = useState<AdminUser[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [msg, setMsg] = useState<string | null>(null)
  const [manage, setManage] = useState<AdminUser | null>(null)
  const load = (): void =>
    void adminListUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
  useEffect(load, [])

  const adminCount = users.filter((u) => u.role === 'admin').length

  const create = async (): Promise<void> => {
    setMsg(null)
    const res = await adminCreateUser({ email: email.trim(), name: name.trim(), password, role })
    if (res.ok) {
      setEmail('')
      setName('')
      setPassword('')
      setRole('user')
      load()
    } else {
      setMsg(res.status === 409 ? t('admin.emailExists') : t('admin.createFailed'))
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{t('admin.createUser')}</h2>
      </div>
      <div className="field-row">
        <Field label={t('admin.name')}>
          {(p) => (
            <input
              {...p}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('admin.email')}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="field-row" style={{ marginTop: 'var(--space-4)', alignItems: 'end' }}>
        <Field label={t('admin.password')} hint={t('admin.passwordHint')}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <div className="field">
          <span className="field-label">{t('admin.role')}</span>
          <Segmented
            ariaLabel={t('admin.newUserRoleAria')}
            value={role}
            onChange={setRole}
            options={[
              { value: 'user', label: t('admin.roleUser') },
              { value: 'admin', label: t('admin.roleAdmin') },
            ]}
          />
        </div>
        <div>
          <button
            type="button"
            className="btn btn-accent btn-lg"
            onClick={create}
            disabled={!email.trim() || password.length < 8 || !name.trim()}
          >
            {t('admin.create')}
          </button>
        </div>
      </div>
      {msg ? (
        <p className="field-error" style={{ marginTop: 'var(--space-3)' }}>
          {msg}
        </p>
      ) : null}
      <div className="table-wrap" style={{ marginTop: 'var(--space-5)' }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.name')}</th>
              <th>{t('admin.email')}</th>
              <th>{t('admin.role')}</th>
              <th>{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  {u.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser')}
                  {u.id === selfId ? <span className="muted"> · {t('admin.you')}</span> : null}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    data-manage-user={u.id}
                    onClick={() => setManage(u)}
                  >
                    {t('admin.manage')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {manage && (
        <ManageUserModal
          user={manage}
          isSelf={manage.id === selfId}
          adminCount={adminCount}
          onClose={() => setManage(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

/** Super-admin "full control" panel for one user: rename, change role, reset password, delete. */
function ManageUserModal({
  user,
  isSelf,
  adminCount,
  onClose,
  onChanged,
}: {
  user: AdminUser
  isSelf: boolean
  adminCount: number
  onClose: () => void
  onChanged: () => void
}) {
  const t = useT()
  const toast = useToast()
  const [name, setName] = useState(user.name)
  const [role, setRole] = useState<'admin' | 'user'>(user.role === 'admin' ? 'admin' : 'user')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const lastAdmin = user.role === 'admin' && adminCount <= 1
  const passwordTooShort = password.length > 0 && password.length < 8

  const save = async (): Promise<void> => {
    setMsg(null)
    const patch: { role?: 'admin' | 'user'; name?: string; password?: string } = {}
    if (name.trim() && name.trim() !== user.name) {
      patch.name = name.trim()
    }
    if (role !== (user.role === 'admin' ? 'admin' : 'user')) {
      patch.role = role
    }
    if (password.length >= 8) {
      patch.password = password
    }
    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }
    setBusy(true)
    const res = await adminPatchUser(user.id, patch)
    setBusy(false)
    if (res.ok) {
      toast.success(t('admin.saved'))
      onChanged()
      onClose()
    } else {
      onChanged()
      setMsg(res.status === 409 ? t('admin.lastAdminDemote') : t('admin.saveFailed'))
    }
  }

  const remove = async (): Promise<void> => {
    setMsg(null)
    setBusy(true)
    const res = await adminDeleteUser(user.id)
    setBusy(false)
    if (res.ok) {
      toast.success(t('admin.userDeleted'))
      onChanged()
      onClose()
    } else {
      setMsg(
        res.status === 409
          ? isSelf
            ? t('admin.cannotDeleteSelf')
            : t('admin.lastAdminDelete')
          : t('admin.deleteFailed'),
      )
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('admin.manageUser', { email: user.email })}
      maxWidth={440}
    >
      <Field label={t('admin.name')}>
        {(p) => (
          <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} />
        )}
      </Field>
      <div className="field" style={{ marginTop: 'var(--space-3)' }}>
        <span className="field-label">{t('admin.role')}</span>
        <Segmented
          ariaLabel={t('admin.role')}
          value={role}
          onChange={setRole}
          options={[
            { value: 'user', label: t('admin.roleUser') },
            { value: 'admin', label: t('admin.roleAdmin') },
          ]}
        />
        {lastAdmin ? (
          <p className="hint" style={{ marginTop: 'var(--space-1)' }}>
            {t('admin.onlyAdminHint')}
          </p>
        ) : null}
      </div>
      <div style={{ marginTop: 'var(--space-3)' }}>
        <Field label={t('admin.newPassword')} hint={t('admin.newPasswordHint')}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
      </div>
      {msg ? (
        <p className="field-error" role="alert" style={{ marginTop: 'var(--space-2)' }}>
          {msg}
        </p>
      ) : null}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-4)',
        }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          style={{ color: '#dc2626' }}
          data-delete-user={user.id}
          onClick={remove}
          disabled={busy || isSelf || lastAdmin}
          title={
            isSelf ? t('admin.cannotDeleteSelfTitle') : lastAdmin ? t('admin.lastAdmin') : undefined
          }
        >
          {t('common.delete')}
        </button>
        <button
          type="button"
          className="btn btn-accent"
          onClick={save}
          disabled={busy || passwordTooShort}
        >
          {t('common.save')}
        </button>
      </div>
    </Modal>
  )
}

function BoardsTab() {
  const t = useT()
  const [boards, setBoards] = useState<AdminBoard[]>([])
  useEffect(
    () =>
      void adminListBoards()
        .then(setBoards)
        .catch(() => setBoards([])),
    [],
  )
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{t('admin.allBoards')}</h2>
        <span className="badge">{boards.length}</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.board')}</th>
              <th>{t('admin.owner')}</th>
            </tr>
          </thead>
          <tbody>
            {boards.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>
                  {b.ownerName} <span className="muted">· {b.ownerEmail}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FeedbackTab() {
  const t = useT()
  const [list, setList] = useState<FeedbackListItem[]>([])
  const [kind, setKind] = useState<'' | 'bug' | 'wish'>('')
  const [status, setStatus] = useState<'' | 'open' | 'done'>('open')
  const [shot, setShot] = useState<{ id: string; url: string } | null>(null)
  const load = (): void =>
    void apiListFeedback()
      .then(setList)
      .catch(() => setList([]))
  useEffect(load, [])
  const filtered = list.filter(
    (f) => (!kind || f.kind === kind) && (!status || f.status === status),
  )

  const showShot = (id: string): void => {
    void apiGetFeedback(id)
      .then((d) => setShot(d.screenshot ? { id, url: d.screenshot } : null))
      .catch(() => pushError(t('admin.screenshotLoadFailed')))
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{t('admin.tabFeedback')}</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <select
            className="select input-sm"
            aria-label={t('admin.kind')}
            value={kind}
            onChange={(e) => setKind(e.target.value as '' | 'bug' | 'wish')}
            style={{ width: 'auto' }}
          >
            <option value="">{t('admin.allKinds')}</option>
            <option value="bug">🐞 {t('admin.bug')}</option>
            <option value="wish">💡 {t('admin.wish')}</option>
          </select>
          <select
            className="select input-sm"
            aria-label={t('admin.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | 'open' | 'done')}
            style={{ width: 'auto' }}
          >
            <option value="open">{t('admin.statusOpen')}</option>
            <option value="done">{t('admin.statusDone')}</option>
            <option value="">{t('admin.all')}</option>
          </select>
        </div>
      </div>
      <div className="dashboard-feedback">
        {filtered.length === 0 && <div className="empty-state">{t('admin.noFeedback')}</div>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filtered.map((f) => (
            <li
              key={f.id}
              data-feedback-item={f.id}
              style={{
                borderTop: '1px solid var(--border)',
                padding: 'var(--space-3) 0',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}
              >
                <div
                  style={{ textDecoration: f.status === 'done' ? 'line-through' : 'none', flex: 1 }}
                >
                  <span aria-hidden="true">{f.kind === 'bug' ? '🐞' : '💡'}</span> {f.message}
                  <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>
                    {new Date(f.createdAt).toLocaleString(dateLocale())}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                  {f.hasScreenshot && (
                    <IconButton
                      label={t('admin.showScreenshot')}
                      size="sm"
                      data-feedback-shot={f.id}
                      onClick={() => showShot(f.id)}
                    >
                      📷
                    </IconButton>
                  )}
                  <IconButton
                    label={f.status === 'done' ? t('admin.markOpen') : t('admin.markDone')}
                    size="sm"
                    data-feedback-done-btn={f.id}
                    onClick={() =>
                      void apiSetFeedbackStatus(f.id, f.status === 'done' ? 'open' : 'done').then(
                        load,
                      )
                    }
                  >
                    {f.status === 'done' ? '↺' : '✓'}
                  </IconButton>
                  <IconButton
                    label={t('admin.deleteFeedback')}
                    size="sm"
                    data-feedback-delete={f.id}
                    className="menu-item-danger"
                    onClick={() => void apiDeleteFeedback(f.id).then(load)}
                  >
                    🗑
                  </IconButton>
                </div>
              </div>
              {shot?.id === f.id && (
                <img
                  src={shot.url}
                  alt={t('admin.feedbackScreenshotAlt')}
                  style={{
                    maxWidth: '100%',
                    marginTop: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function DefaultsTab() {
  const t = useT()
  const [defaults, setDefaults] = useState<PartialSettings | null>(null)
  useEffect(
    () =>
      void adminGetSettings()
        .then((d) => setDefaults(d.defaults ?? {}))
        .catch(() => setDefaults({})),
    [],
  )
  if (!defaults) {
    return (
      <div className="card">
        <div className="empty-state">{t('common.loading')}</div>
      </div>
    )
  }
  const eff = resolveEffectiveSettings(defaults, {})
  const save = (next: PartialSettings): void => {
    setDefaults(next)
    void adminPutSettings(next)
  }
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{t('admin.globalDefaults')}</h2>
      </div>
      <p className="hint" style={{ marginBottom: 'var(--space-5)' }}>
        {t('admin.defaultsHint')}
      </p>
      <Field label={t('admin.background')}>
        {(p) => (
          <select
            {...p}
            className="select"
            value={eff.background}
            onChange={(e) => save({ ...defaults, background: e.target.value as Background })}
          >
            {BACKGROUNDS.map((b) => (
              <option key={b} value={b}>
                {localized(BACKGROUND_LABEL[b])}
              </option>
            ))}
          </select>
        )}
      </Field>
      {(['sticky', 'doc', 'checklist', 'link'] as const).map((k) => (
        <Field key={k} label={t('admin.fontSize', { k })}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="number"
              min={8}
              max={200}
              value={eff.fontSizes[k]}
              onChange={(e) =>
                save({
                  ...defaults,
                  fontSizes: { ...defaults.fontSizes, [k]: Number(e.target.value) },
                })
              }
            />
          )}
        </Field>
      ))}
      {(['sticky', 'doc', 'checklist', 'link'] as const).map((k) => (
        <Field key={k} label={t('admin.fontFamily', { k })}>
          {(p) => (
            <select
              {...p}
              className="select"
              value={eff.fonts[k]}
              onChange={(e) =>
                save({ ...defaults, fonts: { ...defaults.fonts, [k]: e.target.value as FontKey } })
              }
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
    </div>
  )
}

function StatsTab() {
  const t = useT()
  const [users, setUsers] = useState(0)
  const [boards, setBoards] = useState(0)
  const [openFb, setOpenFb] = useState(0)
  useEffect(() => {
    void (async () => {
      try {
        const [u, b, f] = await Promise.all([
          adminListUsers(),
          adminListBoards(),
          apiListFeedback(),
        ])
        setUsers(u.length)
        setBoards(b.length)
        setOpenFb(f.filter((x) => x.status === 'open').length)
      } catch {
        pushError(t('admin.statsLoadFailed'))
      }
    })()
  }, [t])
  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
      <div className="stat" style={{ flex: 1, minWidth: 120 }}>
        <span className="stat-value">{users}</span>
        <span className="stat-label">{t('admin.tabUsers')}</span>
      </div>
      <div className="stat" style={{ flex: 1, minWidth: 120 }}>
        <span className="stat-value">{boards}</span>
        <span className="stat-label">{t('admin.tabBoards')}</span>
      </div>
      <div className="stat" style={{ flex: 1, minWidth: 120 }}>
        <span className="stat-value">{openFb}</span>
        <span className="stat-label">{t('admin.openFeedback')}</span>
      </div>
    </div>
  )
}
