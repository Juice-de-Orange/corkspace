import { Navigate, Outlet } from 'react-router-dom'
import { useT } from '../i18n'
import { useSession } from '../lib/auth-client'

/** Gate authed routes: redirect to /login when there is no session. */
export function ProtectedRoute() {
  const t = useT()
  const { data: session, isPending } = useSession()

  if (isPending) {
    return <div className="p-8 text-sm text-neutral-500">{t('common.loading')}</div>
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
