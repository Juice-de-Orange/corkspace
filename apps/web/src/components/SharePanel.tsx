import { useEffect, useState } from 'react'
import {
  apiCreateShare,
  apiInviteMember,
  apiRemoveMember,
  apiRevokeShare,
  fetchMembers,
  fetchShares,
  type MemberRow,
  type ShareRow,
} from '../api/boards'
import { useT } from '../i18n'
import { Field, IconButton, Modal, Segmented, Switch, useToast } from './ui'

/** Owner-only sharing: invite registered users (editor/viewer) + manage external read links. */
export function SharePanel({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const [furniture, setFurniture] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const reload = (): void => {
    void fetchMembers(boardId)
      .then(setMembers)
      .catch(() => setMembers([]))
    void fetchShares(boardId)
      .then(setShares)
      .catch(() => setShares([]))
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: boardId is stable for this panel
  useEffect(reload, [boardId])

  const invite = async (): Promise<void> => {
    setMsg(null)
    const res = await apiInviteMember(boardId, {
      email: email.trim(),
      role,
      showFurniture: furniture,
    })
    if (res.ok) {
      setEmail('')
      reload()
    } else {
      setMsg(res.status === 404 ? t('forms.inviteNoUser') : t('forms.inviteFailed'))
    }
  }
  const removeMember = async (userId: string): Promise<void> => {
    await apiRemoveMember(boardId, userId).catch(() => toast.error(t('forms.removeMemberError')))
    reload()
  }
  const createLink = async (): Promise<void> => {
    await apiCreateShare(boardId, { showFurniture: furniture }).catch(() =>
      toast.error(t('forms.createLinkError')),
    )
    reload()
  }
  const revoke = async (id: string): Promise<void> => {
    await apiRevokeShare(boardId, id).catch(() => toast.error(t('forms.revokeError')))
    reload()
  }
  const shareUrl = (token: string): string => `${window.location.origin}/share/${token}`
  const copy = (token: string): void => {
    void navigator.clipboard?.writeText(shareUrl(token))
    toast.success(t('forms.linkCopied'))
  }

  return (
    <Modal open onClose={onClose} title={t('forms.shareTitle')} maxWidth={440}>
      <section>
        <h3
          className="card-title"
          style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}
        >
          {t('forms.inviteUser')}
        </h3>
        <Field label={t('forms.email')}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="email"
              placeholder={t('forms.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <div className="field" style={{ marginTop: 'var(--space-3)' }}>
          <span className="field-label">{t('forms.role')}</span>
          <Segmented
            ariaLabel={t('forms.role')}
            value={role}
            onChange={setRole}
            options={[
              { value: 'viewer', label: t('forms.roleViewer') },
              { value: 'editor', label: t('forms.roleEditor') },
            ]}
          />
        </div>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'center',
            marginTop: 'var(--space-3)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <Switch checked={furniture} onChange={setFurniture} label={t('forms.showFurniture')} />
          <span>{t('forms.showFurniture')}</span>
        </div>
        {msg ? (
          <p className="field-error" role="alert" style={{ marginTop: 'var(--space-2)' }}>
            {msg}
          </p>
        ) : null}
        <div style={{ marginTop: 'var(--space-3)' }}>
          <button
            type="button"
            className="btn btn-accent"
            onClick={invite}
            disabled={!email.trim()}
          >
            {t('forms.invite')}
          </button>
        </div>

        <ul className="share-list">
          {members.map((m) => (
            <li key={m.userId} className="share-row">
              <span>
                {m.name}{' '}
                <span className="badge">
                  {m.role === 'editor' ? t('forms.roleEditor') : t('forms.roleViewer')}
                </span>
              </span>
              <IconButton
                label={t('forms.removeMember')}
                size="sm"
                onClick={() => removeMember(m.userId)}
              >
                🗑
              </IconButton>
            </li>
          ))}
          {members.length === 0 && <li className="muted">{t('forms.noneInvited')}</li>}
        </ul>
      </section>

      <section style={{ marginTop: 'var(--space-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ fontSize: 'var(--text-base)' }}>
            {t('forms.externalLink')}
          </h3>
          <button type="button" className="btn btn-sm btn-ghost" onClick={createLink}>
            {t('forms.addLink')}
          </button>
        </div>
        <ul className="share-list">
          {shares.map((s) => (
            <li key={s.id} className="share-row">
              <button
                type="button"
                className="btn btn-ghost btn-sm share-link-copy"
                onClick={() => copy(s.token)}
                title={t('forms.copyLink')}
              >
                📋 {shareUrl(s.token)}
              </button>
              <IconButton label={t('forms.revokeLink')} size="sm" onClick={() => revoke(s.id)}>
                🗑
              </IconButton>
            </li>
          ))}
          {shares.length === 0 && <li className="muted">{t('forms.noLinks')}</li>}
        </ul>
      </section>
    </Modal>
  )
}
