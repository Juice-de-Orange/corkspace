import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useValue } from 'signia-react'
import { CanvasRoot } from '../canvas/CanvasRoot'
import { useCameraPersistence } from '../canvas/runtime/use-camera-persistence'
import { useLoadBoard } from '../canvas/runtime/use-load-board'
import { useLoadEntries } from '../canvas/runtime/use-load-entries'
import { boardAccessAtom, boardMetaAtom } from '../canvas/state/board-store'
import { resetBoardClientState } from '../canvas/state/reset-board'
import { myBoardsAtom, userRoleAtom } from '../canvas/state/user-store'
import { AppBrand, AppHeader } from '../components/AppHeader'
import { FeedbackButton } from '../components/FeedbackButton'
import { SharePanel } from '../components/SharePanel'
import { IconButton, Menu } from '../components/ui'
import { langAtom, langIcon, toggleLang, useT } from '../i18n'
import { signOut, useSession } from '../lib/auth-client'
import { themeAtom, themeIcon, toggleTheme } from '../lib/theme'
import { useMediaQuery } from '../lib/use-media-query'

/** Authed shell for a single board: a slim header (switcher + nav + share) over the canvas. */
export function Shell() {
  const { boardId } = useParams()
  const { data: session } = useSession()
  const navigate = useNavigate()
  const theme = useValue(themeAtom)
  const lang = useValue(langAtom)
  const t = useT()
  const meta = useValue(boardMetaAtom)
  const access = useValue(boardAccessAtom)
  const boards = useValue(myBoardsAtom)
  const role = useValue(userRoleAtom)
  const narrow = useMediaQuery('(max-width: 760px)')
  const [shareOpen, setShareOpen] = useState(false)

  const { ready, error } = useLoadBoard(boardId ? { kind: 'board', boardId } : null)
  useCameraPersistence()
  useLoadEntries(ready)

  if (!boardId) {
    return <Navigate to="/" replace />
  }

  async function onSignOut() {
    resetBoardClientState() // don't let this session's undo stack / selection bleed into the next login
    await signOut()
    navigate('/login')
  }

  // Secondary nav: inline at wide, folded into the overflow menu at narrow. The theme toggle
  // (data-theme-toggle) and Abmelden stay inline at EVERY width (asserted by auth/appearance e2e).
  const secondary = (close?: () => void) => (
    <>
      {access?.level === 'owner' && (
        <button
          type="button"
          className={close ? 'menu-item' : 'btn btn-ghost'}
          onClick={() => {
            setShareOpen((v) => !v)
            close?.()
          }}
        >
          {t('shell.share')}
        </button>
      )}
      <button
        type="button"
        className={close ? 'menu-item' : 'btn btn-ghost'}
        onClick={() => {
          navigate('/account')
          close?.()
        }}
      >
        {t('shell.account')}
      </button>
      {role === 'admin' && (
        <button
          type="button"
          className={close ? 'menu-item' : 'btn btn-ghost'}
          onClick={() => {
            navigate('/admin')
            close?.()
          }}
        >
          {t('shell.admin')}
        </button>
      )}
      <FeedbackButton />
    </>
  )

  const left = (
    <>
      <AppBrand />
      {boards.length > 1 ? (
        <Menu
          triggerLabel={t('shell.pickBoard')}
          triggerClassName="btn btn-ghost btn-sm"
          triggerContent={<>{meta?.name ?? t('shell.board')} ▾</>}
        >
          {(close) =>
            boards.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`menu-item ${b.id === boardId ? 'is-active' : ''}`}
                aria-current={b.id === boardId ? 'true' : undefined}
                onClick={() => {
                  navigate(`/b/${b.id}`)
                  close()
                }}
              >
                {b.name}
                {b.level !== 'owner' ? ` · ${b.ownerName}` : ''}
              </button>
            ))
          }
        </Menu>
      ) : (
        meta?.name && <span className="app-header-email">· {meta.name}</span>
      )}
    </>
  )

  const right = (
    <>
      {!narrow && session?.user.email && (
        <span className="app-header-email">{session.user.email}</span>
      )}
      {narrow ? (
        <Menu
          triggerLabel={t('shell.menu')}
          triggerClassName="btn btn-ghost btn-icon"
          triggerContent="⋯"
          align="right"
        >
          {(close) => (
            <>
              {session?.user.email && (
                <div className="menu-item muted" style={{ pointerEvents: 'none' }}>
                  {session.user.email}
                </div>
              )}
              {secondary(close)}
            </>
          )}
        </Menu>
      ) : (
        secondary()
      )}
      <IconButton label={t('shell.themeToggle')} data-theme-toggle onClick={toggleTheme}>
        {themeIcon(theme)}
      </IconButton>
      <IconButton label={t('lang.switch')} data-lang-toggle onClick={toggleLang}>
        {langIcon(lang)}
      </IconButton>
      <button type="button" onClick={onSignOut} className="btn btn-ghost">
        {t('shell.signOut')}
      </button>
    </>
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader left={left} right={right} />
      <main className="relative flex-1">
        {error ? <div className="empty-state">{t('shell.boardNotFound')}</div> : <CanvasRoot />}
        {shareOpen && boardId && (
          <SharePanel boardId={boardId} onClose={() => setShareOpen(false)} />
        )}
      </main>
    </div>
  )
}
