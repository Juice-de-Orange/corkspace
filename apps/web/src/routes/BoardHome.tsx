import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useT } from '../i18n'

/** Landing route: send the user to their own board (from /api/me). */
export function BoardHome() {
  const t = useT()
  const [target, setTarget] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    void fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ defaultBoardId?: string | null }>) : null))
      .then((d) => setTarget(d?.defaultBoardId ?? null))
      .catch(() => setTarget(null))
  }, [])
  if (target === undefined) {
    return <div className="empty-state">{t('common.loading')}</div>
  }
  if (!target) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to={`/b/${target}`} replace />
}
