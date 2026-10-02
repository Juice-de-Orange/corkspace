import { useParams } from 'react-router-dom'
import { useValue } from 'signia-react'
import { CanvasRoot } from '../canvas/CanvasRoot'
import { useLoadBoard } from '../canvas/runtime/use-load-board'
import { useLoadEntries } from '../canvas/runtime/use-load-entries'
import { AppBrand, AppHeader } from '../components/AppHeader'
import { IconButton } from '../components/ui'
import { langAtom, langIcon, toggleLang, useT } from '../i18n'
import { themeAtom, themeIcon, toggleTheme } from '../lib/theme'

/** External, account-less read-only board via a share token (/share/:token). Public entries only. */
export function PublicBoard() {
  const { token } = useParams()
  const theme = useValue(themeAtom)
  const lang = useValue(langAtom)
  const t = useT()
  const { ready, error } = useLoadBoard(token ? { kind: 'token', token } : null)
  useLoadEntries(ready)

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader
        left={<AppBrand />}
        right={
          <>
            <span className="app-header-email">{t('shell.readOnly')}</span>
            {/* Public header's theme/lang toggles intentionally carry NO data-*-toggle (those
                attributes belong only to the authed Shell toggles that e2e drives). */}
            <IconButton label={t('shell.themeToggle')} onClick={toggleTheme}>
              {themeIcon(theme)}
            </IconButton>
            <IconButton label={t('lang.switch')} onClick={toggleLang}>
              {langIcon(lang)}
            </IconButton>
          </>
        }
      />
      <main className="relative flex-1">
        {error ? <div className="empty-state">{t('shell.linkInvalid')}</div> : <CanvasRoot />}
      </main>
    </div>
  )
}
